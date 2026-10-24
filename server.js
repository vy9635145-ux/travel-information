const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (req,res)=>res.json({ok:true, service:'TripGuide'}));
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, ()=>console.log(`TripGuide running at http://localhost:${PORT}`));
