import express from "express"
import { details, episodeServers, episodeStream, search } from "./scraper"
import cors from "cors"
const app = express()

app.use(cors())



app.get("/", (req,res) => {
    res.send("How did you get here!")
})

app.get("/search", async (req,res) => {
    const {q, p} = req.query
    if(!q) return res.status(400).send("No query was entered!")
    const searchResults = await search(q as string, Number(p))
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
    const episodeData = await episodeServers(slug as string, Number(episode))
    res.send(episodeData)
})

app.get("/episodeStream", async(req,res) => {
    const {episode, slug, server} = req.query
    if(!episode || !slug || !server) return res.status(400).send("No episode / slug / server were found!")
    const stream = await episodeStream(slug as string, Number(episode), Number(server))
    res.send(stream ?? "Episode not found!")
})

app.listen(3000, () => {
    console.log("App is ready at: http://localhost:3000")
})