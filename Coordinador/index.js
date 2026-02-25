const socket = io();

const aliveDiv = document.getElementById("alive");
const deadDiv = document.getElementById("dead");

socket.on("servers", servers => {
  aliveDiv.innerHTML = "";
  deadDiv.innerHTML = "";

  Object.entries(servers).forEach(([name, info]) => {
    const el = document.createElement("div");
    el.textContent = name;

    if (info.status === "alive") {
      el.style.background = "#16a34a";
      el.style.padding = "8px";
      el.style.margin = "4px";
      el.style.borderRadius = "6px";
      aliveDiv.appendChild(el);
    } else {
      el.style.background = "#dc2626";
      el.style.padding = "8px";
      el.style.margin = "4px";
      el.style.borderRadius = "6px";
      deadDiv.appendChild(el);
    }
  });
});

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;
const TIMEOUT = 5000;

app.use(cors());
app.use(express.json());

let servers = {};
let totalTimeouts = 0;

// Registrar el servidor
app.post("/register", (req, res) => {
    const { id, url } = req.body;

    if (!id || !url) {
        return res.status(400).json({ error: "id and url required" });
    }

    servers[id] = {
        id,
        url,
        lastHeartbeat: Date.now()
    };

    console.log(`Servidor registrado: ${id} -> ${url}`);

    res.json({ message: "registered" });
});

// Recibir pulso
app.post("/pulse", (req, res) => {
    const { id } = req.body;

    if (!servers[id]) {
        return res.status(404).json({ error: "server not registered" });
    }

    servers[id].lastHeartbeat = Date.now();

    res.json({ message: "pulse received" });
});

// Lista de servidores
app.get("/servers", (req, res) => {
    const now = Date.now();

    const activeServers = Object.values(servers).filter(
        server => now - server.lastHeartbeat <= TIMEOUT
    );

    res.json(activeServers);
});

// Métricas
app.get("/metrics", (req, res) => {
    res.json({
        totalServersTracked: Object.keys(servers).length,
        totalTimeouts
    });
});

// Timeout
setInterval(() => {
    const now = Date.now();

    for (let id in servers) {
        if (now - servers[id].lastHeartbeat > TIMEOUT) {
            console.log(`Servidor eliminado por timeout: ${id}`);
            delete servers[id];
            totalTimeouts++;
        }
    }
}, 2000);

app.listen(PORT, () => {
    console.log(`Coordinator corriendo en puerto ${PORT}`);
});