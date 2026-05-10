import express from 'express';
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send('✅ Express está funcionando en 3001');
});

app.listen(PORT, () => {
  console.log(`Servidor simple en http://localhost:${PORT}`);
});
