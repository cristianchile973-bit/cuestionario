require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { Resend } = require("resend");

const app = express();
app.use(cors());
app.use(express.json());

// Servir formulario
app.use(express.static(__dirname));

const resend = new Resend(process.env.RESEND_API_KEY);

// Base de datos
const DB_FILE = "respuestas.json";
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, "[]");
}

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Ruta para recibir respuestas
app.post("/enviar", async (req, res) => {
    const data = req.body;

    // Guardar en base de datos
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    db.push({ ...data, fecha: new Date().toISOString() });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    // Crear PDF
    const pdfName = `respuesta_${Date.now()}.pdf`;
    const pdfPath = `./${pdfName}`;
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(20).text("Resultados de la Encuesta", { align: "center" });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Fecha: ${new Date().toLocaleString()}`);
    doc.moveDown();

    Object.entries(data).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`);
        doc.moveDown(0.5);
    });

    doc.end();

    // Esperar a que el PDF termine de generarse
    await new Promise(resolve => setTimeout(resolve, 500));

    // Enviar correo con PDF adjunto
    try {
        await resend.emails.send({
            from: "Encuesta <onboarding@resend.dev>",
            to: process.env.EMAIL_TO,
            subject: "Nueva respuesta con PDF adjunto ✔",
            html: `
                <div style="font-family: Arial; padding: 20px;">
                    <h2 style="color: #1a73e8;">Nueva respuesta recibida</h2>
                    <p>Se adjunta un PDF con los detalles.</p>
                </div>
            `,
            attachments: [
                {
                    filename: pdfName,
                    content: fs.readFileSync(pdfPath).toString("base64"),
                }
            ]
        });

        // Borrar PDF temporal
        fs.unlinkSync(pdfPath);

        res.json({ ok: true });

    } catch (error) {
        console.error("Error enviando correo:", error);
        res.status(500).json({ error: "No se pudo enviar el correo" });
    }
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor activo en puerto " + PORT));
