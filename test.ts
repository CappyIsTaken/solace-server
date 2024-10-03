type Pagination = {
    pages: number,
    pageSize: number
    ranges: [[number, number]]
}
    


function paginateEpisodes(episodes: number, episodesPerPage: number) : Pagination {
    let pages = Math.floor(episodes/episodesPerPage)
    const rem = episodes%episodesPerPage
    const ranges: [[number, number]?] = []
    if(rem > 0) pages++
    for(let p = 0; p < (pages-1); p++) {
        ranges.push([episodesPerPage*p, ((p+1)*episodesPerPage)])
    }
    if(rem > 0) {
        ranges.push([episodesPerPage*(pages-1), episodesPerPage*(pages-1)+rem])
    }
    else {
        ranges.push([episodesPerPage*(pages-1), episodesPerPage*(pages)])
    }
    return {
        pages: pages,
        pageSize: episodesPerPage,
        ranges: ranges as [[number, number]]
    }
}

paginateEpisodes(500, 100)