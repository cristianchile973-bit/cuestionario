require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { Resend } = require("resend");

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (tu formulario)
app.use(express.static("public"));

const resend = new Resend(process.env.RESEND_API_KEY);

// Base de datos local
const DB_FILE = "respuestas.json";
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, "[]");
}

// Ruta principal para evitar "Cannot GET /"
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// Ruta para recibir respuestas
app.post("/enviar", async (req, res) => {
    const data = req.body;

    // Guardar en base de datos
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    db.push({ ...data, fecha: new Date().toISOString() });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    // Formato profesional del correo
    const htmlEmail = `
        <div style="font-family: Arial; padding: 20px; background: #f4f7fb;">
            <h2 style="color: #1a73e8;">Nueva respuesta de la encuesta</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            ${Object.entries(data)
                .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
                .join("")}
            <hr>
            <p style="color: #555;">Sistema automático de encuestas</p>
        </div>
    `;

    try {
        await resend.emails.send({
            from: "Encuesta <onboarding@resend.dev>",
            to: process.env.EMAIL_USER,
            subject: "Nueva respuesta recibida ✔",
            html: htmlEmail
        });

        res.json({ ok: true });
    } catch (error) {
        console.error("Error enviando correo:", error);
        res.status(500).json({ error: "No se pudo enviar el correo" });
    }
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor activo en puerto " + PORT));
