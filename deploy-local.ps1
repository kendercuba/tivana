# Compilar frontend y moverlo al backend/dist

Write-Host "🚀 Compilando frontend y copiando a backend/dist..."

# Navegar a frontend
cd frontend

# Compilar
npm run build

# Volver a raíz
cd ..

# Borrar dist antiguo
if (Test-Path backend/dist) {
  Remove-Item -Recurse -Force backend/dist
}


# Copiar nuevo build al backend
Copy-Item -Recurse frontend/dist backend/dist

Write-Host "✅ ¡Deploy local completado con éxito!"
