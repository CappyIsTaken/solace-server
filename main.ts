import express from "express"
import { details, episodeServers, episodeStream, search } from "./scraper"
import cors from "cors"
const app = express()

app.use(cors())


app.get("/search", async (req,res) => {
    const {q} = req.query
    if(!q) return res.status(400).send("No query was entered!")
    const searchResults = await search(q as string)
    res.send(searchResults)
})

app.get("/details", async (req,res) => {
    const {slug} = req.query
    if(!slug) return res.status(400).send("No anime slug found!")
    const animeDetails = await details(slug as string)
    res.send(animeDetails)
})

app.get("/episode", async (req,res) => {
    const {episode,slug} = req.query
    if(!slug || !episode) return res.status(400).send("No slug or episode were found!")
    const episodeData = await episodeServers(slug, episode)
    res.send(episodeData)
})

app.get("/episodeStream", async(req,res) => {
    const {episode, slug, server} = req.query
    if(!episode || !slug || !server) return res.status(400).send("No episode / slug / server were found!")
    const stream = await episodeStream(slug, episode, server)
    res.send(stream)
})

app.listen(3000, () => {
    console.log("App is ready at: http://localhost:3000")
})