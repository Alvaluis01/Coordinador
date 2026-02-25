const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors:{ origin:"*" }
});

io.on("connection", ()=>{
  console.log("UI conectada");
  emitServersUI();
});

app.use(express.json());

/* ⭐ ESTA LINEA FALTABA */
app.use(express.static("public"));

const port = 3000;

let totalTimeouts = 0;
let servers = {};

function emitServersUI(){
    const now = Date.now();
    const formatted = {};

    Object.values(servers).forEach(s=>{
        const alive = now - s.lastPulse <= 15000;

        formatted[s.name]={
            status: alive ? "alive":"dead",
            url: s.url
        };
    });

    io.emit("servers", formatted);
}

let serverProcesses = {};
let nextPort = 4000;

app.get("/", (req, res) => {
    res.send("Middleware is running");
});

/* ⭐ RUTA UI */
app.get("/servers-ui",(req,res)=>{
  res.sendFile(__dirname+"/public/servers-ui.html");
});

httpServer.listen(port, () => {
  console.log(`Middleware is running on http://localhost:${port}`);
});


// Crear servidor
app.post("/create-server", (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Se requiere Nombre" });
    }

    const assignedPort = nextPort++;

    const process = spawn('node', ['miniServer.js', assignedPort, name], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    if (!fs.existsSync("logs")) {
        fs.mkdirSync("logs");
    }

    const logStream = fs.createWriteStream(`logs/${name}.log`, { flags: 'a' });

    process.stdout.pipe(logStream);
    process.stderr.pipe(logStream);

    serverProcesses[name] = {
        process,
        port: assignedPort
    };

    console.log(`Inicia '${name}' en http://localhost:${assignedPort}`);

    res.json({
        message: `Server '${name}' creado`,
        port: assignedPort
    });
});


// Registrar servidor
app.post("/register", (req, res) => {
    const { name, url } = req.body;

    if (!name || !url) {
        return res.status(400).json({ error: "Se requiere Nombre y URL" });
    }

    servers[name] = {
        name,
        url,
        lastPulse: Date.now()
    };

    console.log(`Server registered: ${name}`);

    res.json({ message: "Server registrado correctamente" });

    emitServersUI(); // ⭐ actualizar UI
});


// Pulso
app.post("/pulse/:name", (req, res) => {
    const { name } = req.params;

    if (servers[name]) {
        servers[name].lastPulse = Date.now();
        emitServersUI(); // ⭐ actualizar UI
        return res.json({ message: "Pulso recibido" });
    }

    res.status(404).json({ error: "Servidor no registrado" });
});


// Listar servidores (API intacta)
app.get("/servers", (req, res) => {
    const now = Date.now();

    const list = Object.values(servers).map(s => ({
        id: s.name,
        url: s.url,
        lastHeartbeatMs: now - s.lastPulse,
        status: "Activo"
    }));

    res.json(list);
});

app.get("/metrics", (req, res) => {

    const totalTracked = Object.keys(servers).length;

    res.json({
        totalTracked,
        activeServers: totalTracked,
        totalTimeouts,
        coordinatorTime: Date.now()
    });
});


// Detectar muertos
setInterval(() => {
    const now = Date.now();
    const timeout = 15000;

    Object.keys(servers).forEach(name => {
        if (now - servers[name].lastPulse > timeout) {

            console.log(`Server muerto: ${name}`);

            totalTimeouts++;

            if (serverProcesses[name]) {
                serverProcesses[name].process.kill();
                delete serverProcesses[name];
            }

            delete servers[name];
            emitServersUI(); // ⭐ actualizar UI
        }
    });
}, 10000);