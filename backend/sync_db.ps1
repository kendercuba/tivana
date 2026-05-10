# ESTE ARCHIVO ES PARA SINCRONIZAR LA BASE DE DATOS LOCAL CON LA DE PRODUCCION (DIGITALOCEAN) CUANDO SE EJECUTA SE COPIA TODO Y SE IGUALAN LAS BASES DE DATOS.
# PERO ESTE SCRIPT BORRA LA BASE COMPLETA Y LA SOBREESCRIBE SI QUEREMOS ACTUALIZAR SOLO LO NUEVO ES MEJOR USAR EL OTRO SCRIPS sync_migrate.ps1
# PARA EJECUTARLO DESDE EL BACKEND ES >   bash sync_db.sh

# ----------------------------------------------
#  Sync LOCAL PostgreSQL → DigitalOcean
# ----------------------------------------------

Write-Host "🌀 Exportando base local..."

pg_dump -U postgres -h localhost -d tivana_db -Fc -f backup_local.dump

if (!$?) {
    Write-Host "❌ Error exportando base local"
    exit
}

Write-Host "🌍 Importando en DigitalOcean..."

pg_restore -U postgres -h 134.199.203.65 -d tivana_db --clean --no-owner backup_local.dump

if (!$?) {
    Write-Host "❌ Error importando en DigitalOcean"
    exit
}

Write-Host "✅ ¡Sincronización completada!"


