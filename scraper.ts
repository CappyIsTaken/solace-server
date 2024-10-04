import {parse} from "node-html-parser";
import CryptoJS from "crypto-js";
import {writeFileSync} from "fs"
type AnimeItem = {
    title: string,
    image: string,
    slug: string,
    releaseYear: number
}

type SearchResponse = {
    page: number,
    totalPages: number,
    animes: AnimeItem[]
}

type DetailsResponse = {
    title: string,
    image: string,
    episodes: number,
    props: AnimeDetailProperty[]
}

type AnimeDetailProperty = {
    name: string,
    value: string | string[]
}

type EpisodeResponse = {
    servers: AnimeServer[],
    title: string,
    episodes: number,
    hasNext: boolean,
    hasPrevious: boolean
}

type AnimeServer = {
    server: string,
    id: string
}

type AnimeStreamResponse = {
    sources: Source[],
    episode: number
}

type Source = {
    url: string,
    type: string,
    backup: boolean
}

function unpack(p,a,c,k,e,d): string {while(c--)if(k[c])p=p.replace(new RegExp('\\b'+c.toString(a)+'\\b','g'),k[c]);return p}


export const episodeStream = async (slug: string, episode: number = 1, server: number = 1) : Promise<AnimeStreamResponse | undefined> => {
    const request = await fetch(`https://anitaku.pe/${slug}-episode-${episode}`)
    if(!request.ok) return
    const html = await request.text()
    const parsed = parse(html)
    const serversTable = parsed.querySelector(".anime_muti_link")?.querySelector("ul")
    const servers = serversTable?.querySelectorAll(`li`).filter(e => !["anime", "doodstream"].includes(e.getAttribute("class")))

    const serverElement = servers[server] ?? servers[0]
    
    const serverId = serverElement.getAttribute("class")


    const playerURL = serverElement?.querySelector("a")?.getAttribute("data-video")

    //s3taku player fetching
    if(serverId === "vidcdn") {
        const playerData = await fetch(playerURL)
        const playerHTML = await playerData.text()
        const parsedPlayer = parse(playerHTML)
        const episodeData = parsedPlayer.querySelector("script[data-name='episode']")?.getAttribute("data-value")
        const key = parsedPlayer.querySelector("body")?.getAttribute("class")?.split("-")[1]
        const iv = parsedPlayer.querySelector("div[class*='container-']")?.getAttribute("class")?.split("-")[1]
        const decryptedData = CryptoJS.AES.decrypt(episodeData, CryptoJS.enc.Utf8.parse(key), {"iv": CryptoJS.enc.Utf8.parse(iv)})
        const strDec = CryptoJS.enc.Utf8.stringify(decryptedData);
        const id = strDec.substring(0, strDec.indexOf('&'));
        const encId = CryptoJS.AES.encrypt(id, CryptoJS.enc.Utf8.parse(key), {"iv":  CryptoJS.enc.Utf8.parse(iv)}).toString()
        const extra = strDec.substring(strDec.indexOf('&')) + '&alias=' + id
        const sourcesRequest = await fetch(`https://s3taku.com/encrypt-ajax.php?id=${encId}${extra}`, {
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        })
        const sourcesJson = await sourcesRequest.json()
        
        const videoContent = parsedPlayer.querySelector("div[class*='videocontent-']")
        const key2 = videoContent?.getAttribute("class")?.split("-")[1]

        const parsedSources = JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(sourcesJson.data, CryptoJS.enc.Utf8.parse(key2), {
            'iv': CryptoJS.enc.Utf8.parse(iv)
          })));
        
        const source: Source = {
            backup: false,
            type: parsedSources.source[0].type,
            url: parsedSources.source[0].file
        }
        const sourceBackup: Source = {
            backup: false,
            type: parsedSources.source_bk[0].type,
            url: parsedSources.source_bk[0].file
        }

        return {
            episode: episode,
            sources: [source, sourceBackup]
        }
    }


    if(serverId == "streamwish" || serverId == "vidhide") {
        const playerData = await fetch(playerURL)
        const playerHTML = await playerData.text()
        const parsedPlayer = parse(playerHTML)
        const allScripts = parsedPlayer.querySelector("body")?.querySelectorAll("script")
        const myScript = allScripts?.find(s => s.innerHTML.startsWith("eval(function"))
        

        const cleaned = myScript.innerHTML.replace("eval(function(p,a,c,k,e,d){while(c--)if(k[c])p=p.replace(new RegExp('\\b'+c.toString(a)+'\\b','g'),k[c]);return p}", "").replace(".split('|')))", "")
        

        //Start from last to first
        const l_i1 = cleaned.length-2
        const l_i2 = cleaned.indexOf("'|")+1
        const l_arg = cleaned.substring(l_i2, l_i1)

        const s_i1 = l_i2-2
        let s_i2
        for(let i = s_i1-1; i > 0; i--) {
            if(cleaned[i] == ",") {
                s_i2 = i
                break
            }
        }
        const s_arg = cleaned.substring(s_i2+1, s_i1)
        
        const t_i1 = s_i2
        let t_i2
        for(let i = t_i1-1; i > 0; i--) {
            if(cleaned[i] == ",") {
                t_i2 = i
                break
            }
        }
        const t_arg = cleaned.substring(t_i2+1, t_i1)
        
        const f_i1 = cleaned.indexOf("}('")+3
        const f_i2 = t_i2-1
        const f_arg = cleaned.substring(f_i1, f_i2)
        
        const unpacked = unpack(f_arg, t_arg, s_arg, l_arg.split("|"), 0, {})

        //Source
        const source_i1 = unpacked.indexOf('file:"')+6
        const source_i2 = unpacked.indexOf('"', source_i1)
        return {
            episode,
            sources: [
                {
                    backup: false,
                    type: "hls",
                    url: unpacked.substring(source_i1,source_i2)
                }
            ]
        }
    }   


}

export const episodeServers = async (slug: string, episode: number = 1): Promise<EpisodeResponse | undefined> =>  {
    const request = await fetch(`https://anitaku.pe/${slug}-episode-${episode}`)
    const html = await request.text()
    const parsed = parse(html)
    //servers
    const serversTable = parsed.querySelector(".anime_muti_link")?.querySelector("ul")
    const serversElements = serversTable?.querySelectorAll("li")

    //Episodes
        const episodesTable = parsed.querySelector("#episode_page")
        const episodesElements = episodesTable?.querySelectorAll("li")
        const episodesAmount = episodesElements?.at(-1)?.querySelector("a")?.getAttribute("ep_end")

    //Title
    const animeInfo = parsed.querySelector(".anime-info")
    const title = animeInfo?.querySelector("a")?.getAttribute("title")

    const mappedAnimeServers: AnimeServer[] = serversElements?.filter(el => !["doodstream", "anime"].includes(el.getAttribute("class"))).map(el => {
        const serverURL = el.querySelector("a")
        const id = el.getAttribute("class")
        const serverName = serverURL?.innerText.trim().replace("Choose this server", "")
        return {
            id,
            server: serverName
        }
    })

    return {
        episodes: +episodesAmount,
        hasNext: (episode > 0 && episode <+episodesAmount),
        hasPrevious: (episode > 1),
        servers: mappedAnimeServers,
        title
    }

}


export const details = async (slug: string): Promise<DetailsResponse | undefined> =>  {
    const detailsRequest = await fetch(`https://anitaku.pe/category/${slug}`)
    const detailsHTML = await detailsRequest.text()
    const parsed = parse(detailsHTML)
    
    //details
    const detailsElement = parsed.querySelector("div.anime_info_body_bg")
    const image = detailsElement?.querySelector("img")
    const title = detailsElement?.querySelector("h1")
    const types = detailsElement?.querySelectorAll("p.type")



    //Episodes
    const episodesTable = parsed.querySelector("#episode_page")
    const episodesElements = episodesTable?.querySelectorAll("li")
    const episodesAmount = episodesElements?.at(-1)?.querySelector("a")?.getAttribute("ep_end")



    const mappedProps: AnimeDetailProperty[] = types?.map(d => {
        const keyValue = d.innerText.split(":")
        const name = keyValue[0]
        let value = keyValue[1].trim().replaceAll("\n", "").trim()
        if(name.includes("Plot Summary")) {
            value = detailsElement?.querySelector("div.description")?.innerText
        }
        if(name.includes("Other name")) {
            value = value.split(' ').filter(s => s)
        }
        return {
            name: name.trim(),
            value
        }
    })

    return {
        image: image?.getAttribute("src"),
        title: title?.innerText,
        props: mappedProps,
        episodes: +episodesAmount
    }

}




export const search = async (keyword: string, page: number = 1) : Promise<SearchResponse | undefined> => {
    const searchRequest = await fetch(`https://anitaku.pe/search.html?keyword=${keyword}&page=${page}`)
    const searchHTML = await searchRequest.text()

    const parsed = parse(searchHTML)

    //Get Anime List
    const animeList = parsed.querySelector("ul.items")
    const animeItems = animeList?.querySelectorAll("li")
    if(!animeItems) return
    const mappedAnimeItems : AnimeItem[] = animeItems.map((v) => {
        const imageElement = v.querySelector("img")
        const titleElement = v.querySelector("p.name")
        const releasedElement = v.querySelector("p.released")
        if(!titleElement || !releasedElement || !imageElement){ return}
        const title = titleElement.querySelector("a")
        const slug = title.getAttribute("href")
        const image = imageElement.getAttribute("src")

        if(!slug || !title || !image) { return}
        return {
            image: image,
            title: title.innerText,
            slug: slug.split("/").at(-1),
            releaseYear: +releasedElement.innerText.split(": ")[1].trim()
        }
    })
    console.log(mappedAnimeItems)

    //Get Pages
    const pages = parsed.querySelector("ul.pagination-list")?.querySelectorAll("li")
    return {
        page: page,
        animes: mappedAnimeItems,
        totalPages: pages?.length ?? 1
    }


}
