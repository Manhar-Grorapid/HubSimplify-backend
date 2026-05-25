require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("./models/User");

const transformWorkflow =
    require("./utils/transformWorkflow");

const app = express();

app.use(cors());
app.use(express.json());
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected");
    })
    .catch((error) => {
        console.log(error);
    });

const PORT = 4000;

// =====================================
// ROOT
// =====================================

app.get("/", (req, res) => {
    res.send("Server running");
});

// =====================================
// CONNECT
// =====================================

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

// =====================================
// OAUTH CALLBACK
// =====================================

app.get("/oauth/callback", async (req, res) => {

    const code = req.query.code;

    try {

        // =====================================
        // EXCHANGE CODE FOR TOKENS
        // =====================================

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

        const portalId =
            response.data.hub_id;

        // =====================================
        // GENERATE UNIQUE USER ID
        // =====================================

        const userId =
            crypto.randomUUID();

        // =====================================
        // STORE USER IN DB
        // =====================================

        await User.create({

            userId: userId,

            refreshToken:
                refreshToken,
        });

        console.log(
            "USER CREATED:",
            userId
        );

        // =====================================
        // REDIRECT TO FRONTEND
        // =====================================

        res.redirect(
            `https://hub-simplify-frontend-git-auth-rework-grorapid-labs.vercel.app/oauth-success?userId=${userId}`
        );

    } catch (error) {

        console.log(
            error.response?.data ||
            error.message
        );

        console.log(
            error.response?.data ||
            error.message
        );

        res.status(500).json({
            error:
                error.response?.data ||
                error.message
        });
    }

});

// =====================================
// FETCH WORKFLOW
// =====================================

app.get("/workflow/:id", async (req, res) => {

    console.log(
        "HEADERS:",
        req.headers
    );

    const workflowId =
        req.params.id;

    const userId =
        req.headers["x-user-id"];

    try {

        // =====================================
        // VALIDATE USER ID
        // =====================================

        if (!userId) {

            return res.status(401).json({

                error:
                    "Missing userId",
            });
        }

        // =====================================
        // GET USER FROM DB
        // =====================================

        const user =
            await User.findOne({

                userId: userId,
            });

        if (!user) {

            return res.status(404).json({

                error:
                    "User not found",
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

        // =====================================
        // SAVE RAW WORKFLOW
        // =====================================

        fs.writeFileSync(

            "./workflow.json",

            JSON.stringify(
                response.data,
                null,
                2
            )
        );

        // =====================================
        // TRANSFORM WORKFLOW
        // =====================================

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

// =====================================
// START SERVER
// =====================================

app.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT}`
    );

})
