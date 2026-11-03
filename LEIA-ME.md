# Site D’Anjos Nails

## O que tem aqui
| Arquivo | Para quê |
|---|---|
| `index.html` | O site das clientes |
| `admin.html` | O painel da profissional (agenda, folgas, serviços, preços, horários, clientes) |
| `assets/config.js` | **Tudo que você edita**: textos, WhatsApp, Instagram, fotos, depoimentos e a ligação com o Supabase |
| `assets/app.js`, `assets/admin.js` | Funcionamento do site e do painel |
| `assets/style.css`, `assets/admin.css` | Visual |
| `assets/img/` | Imagens |
| `supabase/schema.sql` | Banco de dados com todas as regras de segurança |
| `supabase/seed.sql` | Os 9 serviços iniciais (sem preço) |
| `supabase/testes.sql` | Testes de segurança que eu rodei (opcional) |

## Os dois modos do site
- **Sem Supabase (como está agora):** a cliente escolhe serviço, dia e horário, e o pedido vai pronto para o WhatsApp. Os horários são só o expediente; a profissional confirma a disponibilidade.
- **Com Supabase:** horários livres de verdade, horário reservado some na hora para as outras clientes, link para a cliente cancelar ou remarcar, e o painel da profissional.

## Ligar a agenda online (Supabase, plano gratuito)
1. Crie uma conta em supabase.com e um projeto novo (região **São Paulo**). Guarde a senha do banco.
2. No projeto, abra o **SQL Editor**, cole todo o `supabase/schema.sql` e clique em **Run**. Depois faça o mesmo com `supabase/seed.sql`.
3. Em **Authentication → Users**, crie o usuário da profissional (e-mail e senha) com a opção de confirmar o e-mail automaticamente.
4. Volte ao **SQL Editor** e rode, trocando pelo e-mail dela:
   ```sql
   insert into private.admins (user_id) select id from auth.users where email = 'email-dela@exemplo.com';
   ```
5. Em **Authentication**, **desligue o cadastro de novos usuários** (sign ups). Assim ninguém cria conta. Mesmo que criasse, não veria nada, porque só quem está em `private.admins` acessa o painel.
6. Em **Authentication → URL Configuration**, coloque o endereço do site (ex.: `https://danjos-nails.github.io/`) para o "esqueci minha senha" funcionar.
7. Em **Project Settings → API Keys**, copie a **Project URL** e a chave **publishable** (começa com `sb_publishable_`). Cole em `assets/config.js`:
   ```js
   supabase: { url: "https://SEU-PROJETO.supabase.co", chavePublica: "sb_publishable_..." },
   ```
   **Nunca** use a chave `service_role` / secret no site.
8. Abra `admin.html`, entre com o e-mail e a senha dela e ajuste **preços** e **horários** no painel.

## Antes de divulgar
1. Em `assets/config.js`, preencha o nome dela (`profissional`), Instagram, região e bairros.
2. Troque os textos de `boasVindas` e `sobre` pelos dela, e apague as linhas `confirmar: true` do que ela aprovar (higiene, políticas, pagamento, diferenciais).
3. Coloque **fotos reais** dos trabalhos dela na `galeria`, cada uma com a categoria certa. As 3 fotos atuais vieram do flyer: confirme se são dela.
4. Cole **avaliações reais** em `depoimentos` (com permissão da cliente).
5. Mude `modoDemonstracao: true` para `false`. O que não foi confirmado some do site.

## Fotos
- As fotos do topo e da apresentação são **ilustrativas** (geradas por IA) e aparecem com essa etiqueta. Troque pelas fotos dela quando tiver.
- Para adicionar um trabalho real: coloque o arquivo em `assets/img/` e adicione em `galeria`:
  `{ src: "assets/img/foto.webp", alt: "descrição", legenda: "Texto curto", categoria: "alongamento" },`
  Categorias: `tradicional`, `gel`, `alongamento`, `banho`, `manutencao`, `nailart`, `decoracoes`, `pes`.

## Lembretes
No painel, a aba **Agenda** avisa quando há clientes de amanhã sem lembrete. Um toque em **Enviar lembrete** abre o WhatsApp com a mensagem pronta e marca como enviado. Lembretes 100% automáticos exigem a API paga do WhatsApp Business, que pode ser adicionada depois.

## Publicar no GitHub Pages
Suba a pasta inteira (com `assets` e `supabase`) para um repositório e ative em **Settings → Pages**.
