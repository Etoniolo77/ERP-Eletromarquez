param(
    [string]$outputDir = ""
)

if ($outputDir -eq "") {
    $outputDir = Join-Path $PSScriptRoot "../../data/s5/raw"
}

$siteUrl = "https://eletromarquez.sharepoint.com/sites/App5S"
$lists = @("SubmitList", "PontosObtidos", "PerguntasSala", "PerguntasCaminhao", "PerguntasPatio", "PerguntasDeposito", "Tratativas", "Locais")

if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "--- Autenticando com SharePoint ---" -ForegroundColor Cyan
Write-Host "Uma janela de login do Office 365 pode aparecer." -ForegroundColor Yellow

try {
    Connect-PnPOnline -Url $siteUrl -UseWebLogin
    Write-Host "✅ Autenticado!" -ForegroundColor Green

    foreach ($listName in $lists) {
        Write-Host "Baixando lista: $listName..." -ForegroundColor Cyan
        
        # Coleta os itens de forma mais robusta
        $items = Get-PnPListItem -List $listName -PageSize 5000
        
        # Converte FieldValues (Dictionary) para PSCustomObject para que o Export-Csv funcione corretamente
        $exportData = $items | ForEach-Object {
            New-Object PSObject -Property $_.FieldValues
        }
        
        $exportData | Export-Csv -Path "$outputDir\$listName.csv" -NoTypeInformation -Encoding utf8 -Force
        Write-Host "✅ Sucesso! $listName salvo em $outputDir" -ForegroundColor Green
    }
    
    Disconnect-PnPOnline
}
catch {
    Write-Error "Ocorreu um erro: $($_.Exception.Message)"
}

Write-Host "`nProcesso concluído." -ForegroundColor Yellow
