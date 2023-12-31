import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Client } from "pg";
import { getEnvVarOrFail } from "./support/envVarUtils";
import { setupDBClientConfig } from "./support/setupDBClientConfig";
import morgan from "morgan";

dotenv.config(); //Read .env file lines as though they were env vars.

const dbClientConfig = setupDBClientConfig();
const client = new Client(dbClientConfig);

//Configure express routes
const app = express();

app.use(express.json()); //add JSON body parser to each following route handler
app.use(cors()); //add CORS support to each following route handler

app.use(morgan("tiny"));

app.get("/", async (_req, res) => {
    res.json({ msg: "Hello! There's nothing interesting for GET /" });
});

app.get("/health-check", async (_req, res) => {
    try {
        //For this to be successful, must connect to db
        await client.query("select now()");
        res.status(200).send("system ok");
    } catch (error) {
        //Recover from error rather than letting system halt
        console.error(error);
        res.status(500).send("An error occurred. Check server logs.");
    }
});

app.put("/votes/:breed", async (req, res) => {
    try {
        const { breed } = req.params;
        const values = [breed];
        const text =
            "INSERT INTO breedvotes (breed, votes) VALUES ($1, 1) ON CONFLICT (breed) DO UPDATE SET votes = breedvotes.votes + 1";
        await client.query(text, values);
        res.status(200).send("updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred. Check server logs.");
    }
});

app.put("/users/:id/votecount", async (req, res) => {
    try {
        const { id } = req.params;
        const values = [id];
        const text = "UPDATE users SET votes=votes+1 WHERE id = $1";
        await client.query(text, values);
        res.status(200).send("updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred. Check server logs.");
    }
});

app.get("/votes/leaderboard", async (_req, res) => {
    try {
        const queryText =
            "SELECT * FROM breedvotes ORDER BY votes DESC, breed LIMIT 10";
        const result = await client.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred. Check server logs.");
    }
});

app.post("/users", async (req, res) => {
    try {
        const { username } = req.body;
        const values = [username];
        const text = "INSERT INTO users (username) VALUES ($1) RETURNING *";
        const result = await client.query(text, values);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
    }
});

app.get("/users", async (_req, res) => {
    try {
        const queryText = "SELECT * FROM users";
        const result = await client.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred. Check server logs.");
    }
});

connectToDBAndStartListening();

async function connectToDBAndStartListening() {
    console.log("Attempting to connect to db");
    await client.connect();
    console.log("Connected to db!");

    const port = getEnvVarOrFail("PORT");
    app.listen(port, () => {
        console.log(
            `Server started listening for HTTP requests on port ${port}.  Let's go!`
        );
    });
}
