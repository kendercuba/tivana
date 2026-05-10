# ESTE SCRIP SE EJECUTA CON ./sync_migrate.ps1
# === CONFIGURACIÓN DE LA BASE DE DATOS REMOTA ===
$env:PGPASSWORD = "kender0910"     # contraseña del usuario en DigitalOcean
$PGUSER = "tivana_user"            # usuario de PostgreSQL remoto
$PGHOST = "134.199.203.65"         # IP del droplet
$PGDATABASE = "tivana_db"          # nombre de la base

# === CARPETA DE MIGRACIONES ===
$migrationsFolder = "./database/migrations"

# Ordenar archivos por nombre (alfabéticamente)
$migrationFiles = Get-ChildItem -Path $migrationsFolder -Filter *.sql | Sort-Object Name

Write-Host "`n🔍 Verificando migraciones..." -ForegroundColor Cyan

# === LEER MIGRACIONES YA APLICADAS ===
$applied = psql -h $PGHOST -U $PGUSER -d $PGDATABASE -t -A -c "SELECT filename FROM schema_migrations;"
$appliedList = $applied -split "`n"

foreach ($migration in $migrationFiles) {

    if ($appliedList -contains $migration.Name) {
        Write-Host "✔ YA aplicada: $($migration.Name)" -ForegroundColor Green
    }
    else {
        Write-Host "🚀 Aplicando migración: $($migration.Name)" -ForegroundColor Yellow

        # Ejecutar SQL del archivo
        $sqlContent = Get-Content $migration.FullName -Raw
        psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c $sqlContent

        # Registrar la migración como aplicada
        psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c `
            "INSERT INTO schema_migrations (filename) VALUES ('$($migration.Name)');"

        Write-Host "✅ Migración aplicada: $($migration.Name)" -ForegroundColor Green
    }
}

Write-Host "`n🎉 Migraciones al día!" -ForegroundColor Cyan
