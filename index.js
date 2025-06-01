// npm install express socket.io whatsapp-web.js qrcode
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

app.use(express.static('public'));

const client = new Client();

client.on('qr', async qr => {
    console.log('🛠️ QR generado:', qr); // Verificar en la consola

    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('❌ Error generando QR:', err);
        } else {
            console.log('✅ Imagen QR generada correctamente'); 
            io.emit('qr', url); // Envía la imagen QR al frontend
        }
    });
});

client.on('ready', () => {
    console.log('✅ ¡Cliente conectado a WhatsApp!');
    io.emit('connected'); // Notificar conexión exitosa
});

client.on('message', message => {
    // Filtrar solo mensajes privados (omitimos grupos y estados)
    if (message.from.includes('@c.us')) {
        io.emit('message', { from: message._data.notifyName, body: message.body });
    }
});

client.initialize();

server.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});