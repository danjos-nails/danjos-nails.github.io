/* =====================================================================
   CONFIGURAÇÃO DO SITE — tudo que muda fica aqui.
   ---------------------------------------------------------------------
   • modoDemonstracao: true  → mostra também os itens com confirmar:true
                               (com a etiqueta "a confirmar") e os espaços
                               reservados da galeria.
                       false → esconde tudo que ainda não foi confirmado.
   • supabase: preencha url e chavePublica para ligar a agenda online
     (horários reais, bloqueio de horários ocupados, cancelar/remarcar,
     painel da profissional). Vazio = agendamento pelo WhatsApp.
     Use SOMENTE a chave pública (publishable/anon). Nunca a service_role.
   • Com a agenda online ligada, serviços, preços e horários passam a vir
     do painel (admin.html). Os daqui ficam só como reserva.
   ===================================================================== */
window.SITE = {
  modoDemonstracao: true,

  supabase: {
    url: "https://rjtwjgcbgxfgmanwdkht.supabase.co",
    chavePublica: "sb_publishable_7b_q5qZE7UEjolCU5gepqw_AUc-59Xm",   // chave pública: pode ficar no site
  },

  marca: {
    nome: "D’Anjos Nails",
    profissional: "",                    // nome dela, ex.: "Ana"
    slogan: "Manicure e pedicure a domicílio",
    whatsapp: "5511950788327",           // DDI + DDD + número, só dígitos
    instagram: "",                       // ex.: "https://instagram.com/usuario"
    regiao: "",                          // ex.: "Zona Leste de São Paulo"
    bairros: [],                         // ex.: ["Tatuapé", "Mooca"]
    pagamento: { texto: "Pix, dinheiro e cartão.", confirmar: true },

    /* Sinal para garantir o horário. valor: 0 desliga. */
    sinal: {
      valor: 20,                         // em reais
      pix: "",                           // chave Pix dela (telefone, e-mail, CPF ou aleatória)
      favorecido: "",                    // nome que aparece no Pix, para a cliente conferir
      regra: "Se você cancelar com menos de 24 horas de antecedência ou não estiver no endereço, o sinal não é devolvido.",
    },
  },

  /* Usado só no modo WhatsApp (sem Supabase). 0 = domingo … 6 = sábado. */
  agenda: {
    confirmar: true,
    dias: { 0: null, 1: ["09:00", "19:00"], 2: ["09:00", "19:00"], 3: ["09:00", "19:00"],
            4: ["09:00", "19:00"], 5: ["09:00", "19:00"], 6: ["08:00", "16:00"] },
    intervaloEntreClientes: 40,
    passo: 30,
    antecedenciaMinima: 120,
    diasVisiveis: 21,
  },

  boasVindas: {
    confirmar: true,
    texto: "Que bom que você chegou até aqui. Este cantinho foi feito para você conhecer meu trabalho com calma, escolher o que combina com você e marcar um horário sem complicação. Qualquer dúvida, é só me chamar.",
  },

  sobre: {
    confirmar: true,
    titulo: "Muito prazer, eu cuido das suas mãos como cuidaria das minhas",
    paragrafos: [
      "Comecei a fazer unhas porque adorava ver a cara das pessoas quando terminavam. Aquele olhar de “nossa, ficou do jeito que eu queria” ainda é a minha parte preferida do trabalho.",
      "Decidi atender a domicílio porque sei como a rotina aperta. Levo tudo até você, monto meu cantinho com calma e a gente aproveita esse tempo sem trânsito, sem fila e sem pressa.",
      "Cada atendimento é pensado pra você: o formato que valoriza sua mão, a cor que combina com o seu momento e um acabamento que dura.",
    ],
    assinatura: "",
  },

  diferenciais: [
    { t: "Atendimento na sua casa", d: "Sem trânsito e sem espera. Você recebe o cuidado de salão no seu espaço." },
    { t: "Tempo reservado só para você", d: "Os horários já consideram o deslocamento, então ninguém atende com pressa." },
    { t: "Orientação depois do atendimento", d: "Você sai sabendo como cuidar para as unhas durarem mais.", confirmar: true },
  ],

  /* Serviços de reserva (com Supabase ligado, valem os do painel). preco em reais; null = sem valor. */
  servicos: [
    { id: "manicure", nome: "Manicure tradicional", duracao: 45, preco: null, categoria: "maos",
      resumo: "Cutilagem caprichada, unhas lixadas no formato que você gosta e esmaltação com acabamento limpo.",
      beneficios: ["Cutículas alinhadas sem machucar", "Formato que valoriza seus dedos", "Esmalte bem espalhado, sem borrões"],
      cuidados: ["O esmalte comum leva algumas horas para secar por completo: evite bolsas apertadas e água quente logo depois", "Use luvas ao lavar louça ou limpar a casa para durar mais"] },
    { id: "pedicure", nome: "Pedicure", duracao: 50, preco: null, categoria: "pes",
      resumo: "Cuidado completo dos pés: corte correto das unhas, cutilagem, lixa nos calcanhares e esmaltação.",
      beneficios: ["Corte reto que ajuda a evitar unha encravada", "Pés macios e com aparência cuidada", "Esmaltação durável"],
      cuidados: ["Prefira chinelo ou sandália aberta nas horas seguintes", "Hidrate os pés à noite para manter a maciez"] },
    { id: "gel", nome: "Esmaltação em gel", duracao: 60, preco: null, categoria: "maos",
      resumo: "O esmalte em gel é secado na cabine de LED e você já sai com as unhas prontas, brilhando e sem risco de borrar.",
      beneficios: ["Sai da sessão com a unha seca", "Brilho intenso por mais tempo", "Costuma durar algumas semanas sem lascar"],
      cuidados: ["Não arranque o gel: a remoção correta protege a sua unha", "Evite usar as unhas para abrir latas ou tirar etiquetas"] },
    { id: "alongamento", nome: "Alongamento de unhas", duracao: 150, preco: null, categoria: "maos",
      resumo: "Unhas mais longas e no formato que você escolher, construídas com cuidado para ficarem naturais e resistentes.",
      beneficios: ["Comprimento e formato sob medida", "Unhas uniformes mesmo se as suas quebram fácil", "Base perfeita para esmaltação em gel e nail art"],
      cuidados: ["Não use as unhas como ferramenta", "Se descolar, não puxe: fale com ela"],
      manutencao: "Precisa de manutenção periódica. O intervalo ideal ela combina com você no atendimento." },
    { id: "banho", nome: "Banho de gel", duracao: 90, preco: null, categoria: "maos",
      resumo: "Uma camada de gel sobre a sua unha natural, que fortalece, nivela e deixa tudo mais bonito sem alongar.",
      beneficios: ["Fortalece unhas fracas e que descamam", "Ajuda a deixar a unha crescer sem quebrar", "Acabamento liso e brilhante"],
      cuidados: ["Use luvas em contato com produtos de limpeza"],
      manutencao: "Precisa de manutenção periódica para manter a estrutura." },
    { id: "manutencao", nome: "Manutenção", duracao: 90, preco: null, categoria: "maos",
      resumo: "Para quem já tem alongamento ou banho de gel: preenche a parte que cresceu, corrige o formato e renova a cor.",
      beneficios: ["Unhas sempre com aparência de recém-feitas", "Evita descolamento e infiltração", "Prolonga a vida do alongamento"],
      cuidados: ["O ideal é não passar muito do prazo combinado", "Avise se alguma unha quebrou ou descolou antes da sessão"] },
    { id: "nailart", nome: "Nail art", duracao: 30, preco: null, categoria: "extra", adicional: true,
      resumo: "Desenhos, francesinha, pedrarias ou aquele detalhe delicado em uma ou mais unhas. Combina com qualquer esmaltação.",
      beneficios: ["Deixa a unha com a sua personalidade", "Do discreto ao marcante", "Você pode mandar uma foto de referência"],
      cuidados: ["Mande a referência pelo WhatsApp antes, assim ela separa o material certo", "O tempo varia conforme o desenho"] },
    { id: "blindagem", nome: "Blindagem", duracao: 60, preco: null, categoria: "maos",
      resumo: "Uma proteção extra para a unha natural, que fica mais resistente e com a esmaltação durando mais.",
      beneficios: ["Menos unhas quebradas no dia a dia", "Esmaltação dura mais", "Mantém a aparência natural"],
      cuidados: ["Evite usar as unhas como ferramenta", "Hidrate as cutículas com óleo entre as sessões"] },
    { id: "spa", nome: "Spa dos pés", duracao: 40, preco: null, categoria: "pes",
      resumo: "Esfoliação, hidratação profunda e massagem. Um momento só seu, sem sair de casa.",
      beneficios: ["Pés macios e hidratados", "Remove a pele ressecada", "Relaxa depois de um dia cheio"],
      cuidados: ["Combina muito bem com a pedicure no mesmo atendimento", "Mantenha a hidratação em casa para o efeito durar"] },
  ],

  higiene: {
    confirmar: true,
    itens: [
      { t: "Alicates esterilizados", d: "Instrumentos de metal limpos e esterilizados entre uma cliente e outra." },
      { t: "Lixas e palitos individuais", d: "Materiais descartáveis abertos na sua frente e usados só com você." },
      { t: "Mãos e bancada higienizadas", d: "Antes de começar, tudo é limpo com álcool 70%." },
      { t: "Toalhas limpas", d: "Toalha separada para cada atendimento." },
    ],
  },

  /* Galeria: SOMENTE trabalhos reais dela. Categorias sem foto viram espaço reservado (no modo demonstração). */
  galeriaCategorias: [
    { id: "tradicional", nome: "Esmaltação tradicional" },
    { id: "gel", nome: "Esmaltação em gel" },
    { id: "alongamento", nome: "Alongamento" },
    { id: "banho", nome: "Banho de gel" },
    { id: "manutencao", nome: "Manutenção" },
    { id: "nailart", nome: "Nail art" },
    { id: "decoracoes", nome: "Decorações especiais" },
    { id: "pes", nome: "Pés e spa" },
  ],
  galeria: [
    { src: "assets/img/real-vermelho-nailart.webp", alt: "Unhas das mãos em vermelho com glitter e nail art em uma unha", legenda: "Vermelho com glitter e nail art", categoria: "nailart" },
    { src: "assets/img/real-cinza-pedrarias.webp", alt: "Unhas amendoadas em cinza com francesinha e pedrarias", legenda: "Cinza com pedrarias", categoria: "decoracoes" },
    { src: "assets/img/real-vermelho-classico.webp", alt: "Unhas das mãos em vermelho clássico com formato quadrado", legenda: "Vermelho clássico", categoria: "tradicional" },
    { src: "assets/img/real-vinho-maos.webp", alt: "Unhas das mãos esmaltadas em vinho", legenda: "Vinho", categoria: "tradicional" },
    { src: "assets/img/real-branco-leitoso.webp", alt: "Unhas das mãos em branco leitoso", legenda: "Branco leitoso", categoria: "tradicional" },
    { src: "assets/img/real-pedicure-vinho.webp", alt: "Pedicure com esmaltação vinho", legenda: "Pedicure · vinho", categoria: "pes" },
    { src: "assets/img/real-pedicure-francesinha.webp", alt: "Pedicure com francesinha branca", legenda: "Pedicure · francesinha", categoria: "pes" },
    { src: "assets/img/real-pedicure-glitter.webp", alt: "Pedicure nude com detalhe em glitter e coração", legenda: "Pedicure · nude com glitter", categoria: "pes" },
  ],

  /* Avaliações REAIS de clientes, com permissão para usar o primeiro nome. */
  depoimentos: [],

  politicas: {
    confirmar: true,
    itens: [
      { t: "Cancelamento ou remarcação", d: "Se precisar desmarcar, avise com pelo menos 24 horas de antecedência. Assim ela consegue oferecer o horário para outra cliente." },
      { t: "Atrasos", d: "Como ela vai até você, combine pelo WhatsApp se não for estar em casa no horário. Atrasos longos podem exigir remarcação." },
      { t: "Se ela se atrasar", d: "O trânsito às vezes atrapalha. Se acontecer, ela avisa você pelo WhatsApp antes do horário." },
      { t: "Taxa de deslocamento", d: "Dependendo da distância, pode haver uma taxa. Ela informa o valor na confirmação, antes do atendimento." },
    ],
  },

  faq: [
    { p: "Como funciona o agendamento pelo site?", agenda: true, r: "" },
    { p: "Preciso preparar alguma coisa em casa?",
      r: "Só um cantinho com boa iluminação, uma mesa e uma cadeira confortável. Para os pés, um lugar onde você possa se sentar com os pés apoiados. O resto ela leva." },
    { p: "Quanto tempo dura a esmaltação em gel?",
      r: "Em geral, algumas semanas, dependendo do crescimento da sua unha e da sua rotina. Usar luvas nas tarefas de casa e não usar as unhas como ferramenta faz bastante diferença." },
    { p: "Posso mandar uma foto de referência?",
      r: "Pode e deve! Mande a foto pelo WhatsApp depois de agendar. Assim ela já chega com as cores e o material certos." },
    { p: "Como cancelo ou remarco?", agendaCancel: true, r: "" },
    { p: "Atende mais de uma pessoa no mesmo endereço?", confirmar: true,
      r: "Sim. Faça um agendamento para cada pessoa, ou avise na observação quantas pessoas são, para ela reservar o tempo necessário." },
    { p: "Quais formas de pagamento são aceitas?", confirmar: true, usarPagamento: true, r: "" },
  ],
};
