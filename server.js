require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const prisma =
    require("./prisma");

const transformWorkflow =
    require("./utils/transformWorkflow");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 4000;

app.get("/", (req, res) => {
    res.send("Server running");
});

// Connect
app.get("/connect", (req, res) => {

    const scopes = [
        "automation",
        "content",
        "crm.objects.contacts.read",
        "oauth"
    ].join(" ");

    const authUrl =
        `https://app.hubspot.com/oauth/authorize` +
        `?client_id=${process.env.CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(scopes)}`;

    res.redirect(authUrl);
});

// Oauth callback
app.get("/oauth/callback", async (req, res) => {
    const code = req.query.code;
    try {
        const response = await axios.post(
            "https://api.hubapi.com/oauth/v1/token",
            new URLSearchParams({
                grant_type: "authorization_code",
                client_id:
                    process.env.CLIENT_ID,
                client_secret:
                    process.env.CLIENT_SECRET,
                redirect_uri:
                    process.env.REDIRECT_URI,
                code: code,
            }),
            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },
            }
        );

        const refreshToken =
            response.data.refresh_token;

        await prisma.user.upsert({

            where: {
                id: "default-user",
            },

            update: {
                refreshToken,
            },

            create: {
                id: "default-user",
                refreshToken,
            },
        });
        res.send(`
                <h2>
                HubSpot Connected Successfully
                </h2>

                <p>
                You can close this tab.
                </p>
        `);
    } catch (error) {
        res.status(500).send(
            "OAuth failed"
        );
    }
});

// Workflow
// Workflow
app.get("/workflow/:id", async (req, res) => {

    console.log(
        "HEADERS:",
        req.headers
    );

    const workflowId =
        req.params.id;

    try {

        // =====================================
        // GET USER FROM DB
        // =====================================

        const user =
            await prisma.user.findUnique({

                where: {
                    id: "default-user",
                },
            });

        if (!user) {

            return res.status(401).json({
                error:
                    "No connected account",
            });
        }
        console.log(
            "DB USER:",
            user
        );

        // =====================================
        // GET ACCESS TOKEN
        // =====================================

        const tokenResponse =
            await axios.post(

                "https://api.hubapi.com/oauth/v1/token",

                new URLSearchParams({

                    grant_type:
                        "refresh_token",

                    client_id:
                        process.env.CLIENT_ID,

                    client_secret:
                        process.env.CLIENT_SECRET,

                    refresh_token:
                        user.refreshToken,

                }),

                {
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded",
                    },
                }
            );

        const accessToken =
            tokenResponse.data.access_token;

        console.log(
            "ACCESS TOKEN RECEIVED"
        );

        // =====================================
        // FETCH WORKFLOW
        // =====================================

        const response =
            await axios.get(

                `https://api.hubapi.com/automation/v4/flows/${workflowId}`,

                {
                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`,
                    },
                }
            );

        console.log(
            "WORKFLOW RESPONSE:",
            response.data
        );

        fs.writeFileSync(

            "./workflow.json",

            JSON.stringify(
                response.data,
                null,
                2
            )
        );

        const transformed =
            transformWorkflow(
                response.data
            );

        res.json(transformed);

    } catch (error) {

        console.log(
            error.response?.data ||
            error.message
        );

        res.status(500).json({

            error:
                error.response?.data ||
                error.message,
        });
    }
});

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );
});