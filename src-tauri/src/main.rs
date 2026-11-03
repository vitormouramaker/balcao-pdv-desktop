#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::fs;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone)]
struct CartItem {
    id: u32,
    name: String,
    price: f64,
    quantity: u32,
}

#[tauri::command]
fn ler_config(app: tauri::AppHandle) -> Result<String, String> {
    let document_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Erro ao obter diretório de config: {}", e))?;
    let config_path = document_dir.join("pdv").join("config.json");

    if !config_path.exists() {
        return Err(format!("Arquivo de configuração não encontrado em {:?}", config_path));
    }

    let data = fs::read_to_string(&config_path)
        .map_err(|e| format!("Erro ao ler o arquivo: {}", e))?;
    Ok(data)
}

// Escapa texto que vai dentro do HTML do cupom (nome de produto vem do banco).
fn escapar_html(texto: &str) -> String {
    texto
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace(''', "&#39;")
}

fn gerar_html_cupom(cart: &[CartItem], total: f64) -> String {
    let mut itens_html = String::new();
    
    for item in cart {
        let subtotal = item.quantity as f64 * item.price;
        itens_html.push_str(&format!(
            r#"
            <tr>
                <td style="padding: 2px 0;">{}</td>
                <td style="text-align: center;">{}</td>
                <td style="text-align: right;">R$ {:.2}</td>
                <td style="text-align: right;">R$ {:.2}</td>
            </tr>
            "#,
            escapar_html(&item.name), item.quantity, item.price, subtotal
        ));
    }
    
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {{
            size: 80mm auto;
            margin: 0;
        }}
        @media print {{
            body {{
                margin: 0;
                padding: 0;
            }}
        }}
        body {{
            font-family: 'Courier New', monospace;
            font-size: 11pt;
            width: 72mm;
            margin: 0 auto;
            padding: 5mm;
            background: white;
        }}
        .header {{
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            margin-bottom: 5mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 3mm;
        }}
        .info {{
            font-size: 9pt;
            text-align: center;
            margin-bottom: 5mm;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5mm;
        }}
        th {{
            text-align: left;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
            font-size: 9pt;
        }}
        td {{
            font-size: 10pt;
            padding: 1mm 0;
        }}
        .separator {{
            border-top: 1px dashed #000;
            margin: 3mm 0;
        }}
        .total {{
            font-weight: bold;
            font-size: 13pt;
            text-align: right;
            margin-top: 5mm;
            padding-top: 3mm;
            border-top: 1px dashed #000;
        }}
        .footer {{
            text-align: center;
            margin-top: 8mm;
            font-size: 10pt;
            border-top: 1px dashed #000;
            padding-top: 3mm;
        }}
        .data {{
            text-align: center;
            font-size: 8pt;
            margin-top: 3mm;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="header">BALCAO PDV</div>
    
    <div class="info">
        Cupom Não Fiscal
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Unit.</th>
                <th style="text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
    </table>
    
    <div class="total">
        TOTAL: R$ {:.2}
    </div>
    
    <div class="footer">
        OBRIGADO PELA PREFERÊNCIA!
    </div>
    
    <div class="data">
        {}
    </div>
</body>
</html>"#,
        itens_html,
        total,
        chrono::Local::now().format("%d/%m/%Y %H:%M:%S")
    )
}

#[tauri::command]
fn imprimir_nota(app: tauri::AppHandle, cart: Vec<CartItem>, total: f64) -> Result<String, String> {
    // Gerar HTML do cupom
    let html = gerar_html_cupom(&cart, total);
    
    // Criar diretório temporário
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("Erro ao obter diretório temporário: {}", e))?;
    
    let arquivo_html = temp_dir.join("cupom_fiscal.html");
    
    // Salvar HTML
    fs::write(&arquivo_html, html)
        .map_err(|e| format!("Erro ao criar arquivo HTML: {}", e))?;
    
    // Abrir arquivo no navegador padrão para impressão
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", arquivo_html.to_str().unwrap()])
            .spawn()
            .map_err(|e| format!("Erro ao abrir arquivo: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&arquivo_html)
            .spawn()
            .map_err(|e| format!("Erro ao abrir arquivo: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&arquivo_html)
            .spawn()
            .map_err(|e| format!("Erro ao abrir arquivo: {}", e))?;
    }
    
    Ok(arquivo_html.to_string_lossy().to_string())
}

#[tauri::command]
fn imprimir_direto(app: tauri::AppHandle, cart: Vec<CartItem>, total: f64) -> Result<(), String> {
    // Gerar HTML
    let html = gerar_html_cupom(&cart, total);
    
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("Erro ao obter diretório temporário: {}", e))?;
    
    let arquivo_html = temp_dir.join("cupom_fiscal.html");
    
    fs::write(&arquivo_html, html)
        .map_err(|e| format!("Erro ao criar arquivo: {}", e))?;
    
    // Imprimir diretamente (Windows)
    #[cfg(target_os = "windows")]
    {
        // Usar PowerShell para imprimir direto
        let ps_script = format!(
            r#"Start-Process -FilePath '{}' -Verb Print -WindowStyle Hidden"#,
            arquivo_html.to_str().unwrap()
        );
        
        Command::new("powershell")
            .args(["-Command", &ps_script])
            .spawn()
            .map_err(|e| format!("Erro ao imprimir: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // No Linux, usar lpr se disponível
        Command::new("lpr")
            .arg(&arquivo_html)
            .spawn()
            .map_err(|e| format!("Erro ao imprimir (instale cups-client): {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("lpr")
            .arg(&arquivo_html)
            .spawn()
            .map_err(|e| format!("Erro ao imprimir: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
fn visualizar_cupom(cart: Vec<CartItem>, total: f64) -> Result<String, String> {
    // Retorna o HTML para visualização no frontend
    Ok(gerar_html_cupom(&cart, total))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ler_config, 
            imprimir_nota,
            imprimir_direto,
            visualizar_cupom
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o Tauri");
}