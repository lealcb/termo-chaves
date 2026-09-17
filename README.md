# Gerador de Termo de Entrega de Chaves

Aplicativo estático para preencher e baixar o termo em DOCX e PDF diretamente no navegador.

## Privacidade

Os dados preenchidos são processados apenas no dispositivo do usuário. O site não possui banco de dados, servidor de aplicação, cookies ou ferramenta de análise.

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Publicação

O fluxo em `.github/workflows/deploy-pages.yml` compila e publica o site no GitHub Pages a cada envio para a branch `main`.

No repositório, selecione **Settings > Pages > Source > GitHub Actions** na primeira publicação.
