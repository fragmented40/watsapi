// 📌 Reemplaza el código del servidor en `server.js`
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

app.use(express.static('public'));

const client = new Client({
    authStrategy: new LocalAuth()
});

const chatHistory = {}; // 📌 Almacenar los últimos 10 mensajes por chat

client.on('qr', async qr => {
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
            io.emit('qr', url); // Enviar QR al frontend
        }
    });
});

client.on('ready', () => {
    console.log('✅ ¡Conectado a WhatsApp!');
    io.emit('connected');
});

// 📌 Recibir mensajes y enviarlos al frontend
client.on('message', async message => {
    if (message.from.includes('@c.us')) { // Solo chats privados
        let mediaUrl = null;

        if (message.hasMedia) {
            const media = await message.downloadMedia();
            mediaUrl = `data:${media.mimetype};base64,${media.data}`;
        }

        const phoneNumber = message.from.replace('@c.us', '');

        if (!chatHistory[phoneNumber]) chatHistory[phoneNumber] = [];
        chatHistory[phoneNumber].push({ from: message._data.notifyName || "Desconocido", body: message.body, image: mediaUrl });

        if (chatHistory[phoneNumber].length > 10) {
            chatHistory[phoneNumber].shift();
        }

        io.emit('message', {
            from: message._data.notifyName || "Desconocido",
            phone: phoneNumber,
            body: message.body || "Mensaje vacío",
            image: mediaUrl
        });
    }
});

io.on('connection', (socket) => {
    socket.on('sendMessage', async ({ to, body }) => {
        if (!to.includes('@c.us')) return;

        await client.sendMessage(to, body);

        const phoneNumber = to.replace('@c.us', '');
        if (!chatHistory[phoneNumber]) chatHistory[phoneNumber] = [];
        chatHistory[phoneNumber].push({ from: "Tú", body: body });

        if (chatHistory[phoneNumber].length > 10) {
            chatHistory[phoneNumber].shift();
        }

        // 📌 Emitir el mensaje al frontend para que lo muestre en pantalla
        io.emit('message', { from: "Tú", phone: phoneNumber, body: body, image: null });
    });

    socket.on('sendImage', async ({ to, imageBase64 }) => {
        if (!to.includes('@c.us')) {
            console.error("❌ Error: Número incorrecto.");
            return;
        }

        try {
            const media = new MessageMedia("image/png", imageBase64);
            await client.sendMessage(to, media);

            const phoneNumber = to.replace('@c.us', '');
            if (!chatHistory[phoneNumber]) chatHistory[phoneNumber] = [];
            chatHistory[phoneNumber].push({ from: "Tú", body: "Imagen enviada", image: `data:image/png;base64,${imageBase64}` });

            if (chatHistory[phoneNumber].length > 10) {
                chatHistory[phoneNumber].shift();
            }

            // 📌 Emitir la imagen al frontend para mostrarla
            io.emit('message', { from: "Tú", phone: phoneNumber, body: "Imagen enviada", image: `data:image/png;base64,${imageBase64}` });

            console.log(`🖼 Imagen enviada a ${phoneNumber}`);
        } catch (err) {
            console.error("❌ Error enviando imagen:", err);
        }
    });
});

client.initialize();

server.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});