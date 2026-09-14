// --- server.js ---
// A lightweight Node.js Express server to handle API requests securely.
// This keeps your OpenAI API key hidden from the browser / client side.

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint that the frontend calls
app.post('/api/assess', async (req, res) => {
    try {
        const { plan, followUpAnswer, followUpQuestion } = req.body;
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Server configuration error: OpenAI API key is missing on the server.' });
        }

        const systemPrompt = `You are 'Horizons', a highly advanced, serious, and pragmatic risk-assessment AI.
        Your function is to evaluate daily plans and identify potential points of failure based on established principles of risk management, human psychology, and statistical probability.
        You MUST use British English exclusively.

        CRITICAL INSTRUCTION: Your tone must be completely serious, analytical, and objective. You are providing a genuine service to prevent accidents and logistical failures.
        ABSOLUTELY NO HUMOUR, no irony, no satire, and no esoteric or supernatural reasoning. Base your assessments on real-world factors such as:
        - Human error (cognitive biases, rushing, fatigue, distraction).
        - Logistical oversight (poor planning, lack of communication, resource deficiency).
        - Environmental hazards (weather, traffic, infrastructure failure).
        - Equipment malfunction (lack of maintenance, improper use).

        You must output your response in JSON format.

        If the user's plan lacks sufficient detail to perform a thorough risk assessment, set 'needsFollowUp' to true and ask ONE 'followUpQuestion' to acquire specific logistical data (e.g., exact location, transportation method, time of day, involved personnel).

        If you have sufficient data, set 'needsFollowUp' to false and provide your assessment:
        1. 'initialCatastrophe': A realistic, objective analysis of the most probable point of failure or accident inherent in their plan. Detail the practical reasons why this failure might occur.
        2. 'saferSolution': A practical, actionable risk-mitigation strategy to address the primary vulnerability.
        3. 'saferSolutionCatastrophe': An analysis of residual risks or secondary failure points that exist even with the mitigation strategy implemented (e.g., unforeseen consequences, human non-compliance with the new rule).
        4. 'ultimateSafeSolution': The most secure, low-risk alternative available, even if it requires significant alteration or cancellation of the original plan to guarantee safety.

        Expected JSON schema:
        {
            "needsFollowUp": boolean,
            "followUpQuestion": "string (or null)",
            "verdict": {
                "initialCatastrophe": "string",
                "saferSolution": "string",
                "saferSolutionCatastrophe": "string",
                "ultimateSafeSolution": "string"
            }
        }`;

        let userPromptText = `User input parameters: "${plan}"`;
        if (followUpAnswer) {
            userPromptText += `\nRequested logistical data: "${followUpQuestion}"\nProvided data: "${followUpAnswer}"`;
        }

        // --- TIMEOUT & FETCH BLOCK ---
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout

        let openaiResponse;
        try {
            openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPromptText }
                    ],
                    response_format: { type: "json_object" }
                }),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId); // Guaranteed cleanup of timer
        }

        if (!openaiResponse.ok) {
            const errData = await openaiResponse.json();
            throw new Error(errData.error?.message || 'OpenAI API request failed');
        }

        const data = await openaiResponse.json();
        const jsonText = data.choices[0].message.content;
        const parsedData = JSON.parse(jsonText);

        res.json(parsedData);

    } catch (error) {
        console.error('Backend Assessment Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error during assessment.' });
    }
});

app.listen(PORT, () => {
    console.log(`Horizons secure server running on port ${PORT}`);
});
