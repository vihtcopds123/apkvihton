# Vihton Social Network - Скрипт автоматического деплоя на VPS
# Запуск в PowerShell: .\deploy.ps1

$DEFAULT_IP = "194.5.78.150"
$DEFAULT_TARGET = "/var/www/vihtclub/dist/"

Write-Host "=== Vihton Social Network Deployer ===" -ForegroundColor Cyan
$IP_ADDRESS = Read-Host "Введите IP-адрес вашего VPS сервера (нажмите Enter для $DEFAULT_IP)"
if ([string]::IsNullOrWhiteSpace($IP_ADDRESS)) {
    $IP_ADDRESS = $DEFAULT_IP
}

$TARGET_DIR = Read-Host "Введите путь на сервере (нажмите Enter для $DEFAULT_TARGET)"
if ([string]::IsNullOrWhiteSpace($TARGET_DIR)) {
    $TARGET_DIR = $DEFAULT_TARGET
}

Write-Host "`n1. Сборка фронтенда (npm run build)..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при сборке проекта! Деплой отменен." -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Загрузка сборки на VPS (root@$($IP_ADDRESS):$TARGET_DIR)..." -ForegroundColor Yellow
scp -r dist/* "root@$($IP_ADDRESS):$TARGET_DIR"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n3. Исправление прав доступа к директориям на VPS..." -ForegroundColor Yellow
    ssh "root@$($IP_ADDRESS)" "chmod 755 $($TARGET_DIR)assets && chmod 644 $($TARGET_DIR)assets/* && chmod 755 $($TARGET_DIR)profile_effects && chmod 644 $($TARGET_DIR)profile_effects/*"
    
    Write-Host "`n[УСПЕХ] Проект Vihton успешно собран, загружен на ваш VPS и права доступа настроены!" -ForegroundColor Green
    Write-Host "Адрес сервера: $IP_ADDRESS" -ForegroundColor Green
    Write-Host "Путь на сервере: $TARGET_DIR" -ForegroundColor Green
} else {
    Write-Host "`n[ОШИБКА] Ошибка загрузки файлов на VPS! Проверьте:" -ForegroundColor Red
    Write-Host "1. Правильность IP-адреса ($IP_ADDRESS)" -ForegroundColor Red
    Write-Host "2. Наличие SSH-ключа или пароля доступа" -ForegroundColor Red
    Write-Host "3. Наличие прав записи в папку $TARGET_DIR на сервере" -ForegroundColor Red
}
