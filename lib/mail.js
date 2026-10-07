// BAO emails (account confirmation, password link, account closing, therapist hand-over), sent with Resend.
// Needs, in Cloudflare Pages > Settings > Variables and Secrets:
//   RESEND_API_KEY  (secret)   the key from resend.com
//   MAIL_FROM                  BAO <hello@baotracker.com>   (the domain must be "Verified" in Resend)
//   APP_URL                    https://baotracker.com
// When something is missing or Resend refuses, the reason is written in the Functions log.

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function base(env, request){
  return String(env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '');
}

export async function sendMail(env, to, mail){
  if (!env.RESEND_API_KEY){
    console.log('BAO MAIL NOT SENT: RESEND_API_KEY is missing. To:', to, '| Subject:', mail.subject);
    return false;
  }
  const from = env.MAIL_FROM || 'BAO <onboarding@resend.dev>';
  try{
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text })
    });
    if (!res.ok){
      console.log('BAO MAIL REFUSED by Resend:', res.status, await res.text(), '| from:', from);
      return false;
    }
    return true;
  }catch(e){
    console.log('BAO MAIL: Resend could not be reached:', e && e.message);
    return false;
  }
}

const T = {
  en: { hi: n => n ? 'Hi ' + n + ',' : 'Hi,', foot: 'You are getting this email because this address was used on BAO.', privacy: 'Privacy',
        cSub: 'Confirm your email for BAO 🐼', cHead: 'Welcome to BAO 💚',
        cP: ['Your account is ready. Please confirm that this email is yours, so we can help you if you ever forget your password.',
             'Once a day Bao will ask how your body felt, where and how strongly. You can leave any question empty: a short check-in still counts.'],
        cBtn: 'Confirm my email', cSmall: ['The link works for 7 days.', 'Did not create this account? Just ignore this email.', 'BAO is a diary, not a medical device. In an emergency, call 112.'],
        rSub: 'Your new BAO password 🐼', rHead: 'Choose a new password',
        rP: ['Someone asked to change the password of your BAO account.'], rBtn: 'Choose a new password',
        rSmall: ['The link works for 30 minutes, and only once.', 'If it was not you, ignore this email: your password stays the same.'] },
  de: { hi: n => n ? 'Hallo ' + n + ',' : 'Hallo,', foot: 'Du bekommst diese E-Mail, weil diese Adresse bei BAO verwendet wurde.', privacy: 'Datenschutz',
        cSub: 'Bestätige deine E-Mail für BAO 🐼', cHead: 'Willkommen bei BAO 💚',
        cP: ['Dein Konto ist bereit. Bitte bestätige, dass diese E-Mail dir gehört, damit wir dir helfen können, falls du dein Passwort vergisst.',
             'Einmal am Tag fragt dich Bao, wie sich dein Körper angefühlt hat, wo und wie stark. Du darfst jede Frage leer lassen: Auch ein kurzer Check-in zählt.'],
        cBtn: 'E-Mail bestätigen', cSmall: ['Der Link gilt 7 Tage.', 'Hast du dieses Konto nicht erstellt? Dann ignoriere diese E-Mail einfach.', 'BAO ist ein Tagebuch, kein Medizinprodukt. Im Notfall wähle die 112.'],
        rSub: 'Dein neues BAO-Passwort 🐼', rHead: 'Neues Passwort wählen',
        rP: ['Jemand möchte das Passwort deines BAO-Kontos ändern.'], rBtn: 'Neues Passwort wählen',
        rSmall: ['Der Link gilt 30 Minuten und nur ein einziges Mal.', 'Warst du das nicht, ignoriere diese E-Mail: Dein Passwort bleibt gleich.'] },
  it: { hi: n => n ? 'Ciao ' + n + ',' : 'Ciao,', foot: 'Ricevi questa email perché questo indirizzo è stato usato su BAO.', privacy: 'Privacy',
        cSub: 'Conferma la tua email per BAO 🐼', cHead: 'Ti diamo il benvenuto in BAO 💚',
        cP: ['Il tuo account è pronto. Conferma che questa email è tua, così potremo aiutarti se un giorno dimentichi la password.',
             'Una volta al giorno Bao ti chiederà come si è sentito il tuo corpo, dove e quanto forte. Puoi lasciare vuota qualsiasi domanda: anche un check-in breve conta.'],
        cBtn: 'Conferma la mia email', cSmall: ['Il link vale 7 giorni.', 'Non hai creato tu questo account? Ignora questa email.', 'BAO è un diario, non un dispositivo medico. In caso di emergenza chiama il 112.'],
        rSub: 'La tua nuova password di BAO 🐼', rHead: 'Scegli una nuova password',
        rP: ['Qualcuno ha chiesto di cambiare la password del tuo account BAO.'], rBtn: 'Scegli una nuova password',
        rSmall: ['Il link vale 30 minuti e si può usare una sola volta.', 'Se non hai fatto tu questa richiesta, ignora questa email: la password resta la stessa.'] },
  fr: { hi: n => n ? 'Coucou ' + n + ',' : 'Bonjour,', foot: 'Tu reçois cet e-mail parce que cette adresse a été utilisée sur BAO.', privacy: 'Confidentialité',
        cSub: 'Confirme ton e-mail pour BAO 🐼', cHead: 'Bienvenue sur BAO 💚',
        cP: ['Ton compte est prêt. Confirme que cet e-mail est bien le tien, pour que nous puissions t’aider si tu oublies ton mot de passe.',
             'Une fois par jour, Bao te demandera comment ton corps s’est senti, où et à quel point. Tu peux laisser n’importe quelle question vide.'],
        cBtn: 'Confirmer mon e-mail', cSmall: ['Le lien marche pendant 7 jours.', 'Tu n’as pas créé ce compte ? Ignore simplement cet e-mail.', 'BAO est un journal, pas un dispositif médical. En cas d’urgence, appelle le 112.'],
        rSub: 'Ton nouveau mot de passe BAO 🐼', rHead: 'Choisis un nouveau mot de passe',
        rP: ['Quelqu’un a demandé à changer le mot de passe de ton compte BAO.'], rBtn: 'Choisir un nouveau mot de passe',
        rSmall: ['Le lien marche 30 minutes, une seule fois.', 'Si ce n’était pas toi, ignore cet e-mail : ton mot de passe ne change pas.'] },
  es: { hi: n => n ? 'Hola ' + n + ',' : 'Hola,', foot: 'Recibes este correo porque esta dirección se usó en BAO.', privacy: 'Privacidad',
        cSub: 'Confirma tu correo para BAO 🐼', cHead: 'Te damos la bienvenida a BAO 💚',
        cP: ['Tu cuenta está lista. Confirma que este correo es tuyo, para que podamos ayudarte si alguna vez olvidas la contraseña.',
             'Una vez al día Bao te preguntará cómo se sintió tu cuerpo, dónde y con qué intensidad. Puedes dejar cualquier pregunta vacía.'],
        cBtn: 'Confirmar mi correo', cSmall: ['El enlace vale 7 días.', '¿No creaste esta cuenta? Ignora este correo.', 'BAO es un diario, no un dispositivo médico. En una emergencia, llama al 112.'],
        rSub: 'Tu nueva contraseña de BAO 🐼', rHead: 'Elige una contraseña nueva',
        rP: ['Alguien pidió cambiar la contraseña de tu cuenta de BAO.'], rBtn: 'Elegir una contraseña nueva',
        rSmall: ['El enlace vale 30 minutos y solo una vez.', 'Si no fuiste tú, ignora este correo: tu contraseña no cambia.'] },
  pt: { hi: n => n ? 'Oi ' + n + ',' : 'Oi,', foot: 'Você recebeu este e-mail porque este endereço foi usado no BAO.', privacy: 'Privacidade',
        cSub: 'Confirme seu e-mail no BAO 🐼', cHead: 'Boas-vindas ao BAO 💚',
        cP: ['Sua conta está pronta. Confirme que este e-mail é seu, para podermos ajudar se você esquecer a senha.',
             'Uma vez por dia o Bao vai perguntar como o seu corpo se sentiu, onde e com que intensidade. Você pode deixar qualquer pergunta em branco.'],
        cBtn: 'Confirmar meu e-mail', cSmall: ['O link vale por 7 dias.', 'Não criou esta conta? É só ignorar este e-mail.', 'O BAO é um diário, não um dispositivo médico. Em uma emergência, ligue para o número de emergência.'],
        rSub: 'Sua nova senha do BAO 🐼', rHead: 'Escolha uma nova senha',
        rP: ['Alguém pediu para trocar a senha da sua conta BAO.'], rBtn: 'Escolher nova senha',
        rSmall: ['O link vale por 30 minutos e só uma vez.', 'Se não foi você, ignore este e-mail: sua senha continua a mesma.'] },
  nl: { hi: n => n ? 'Hoi ' + n + ',' : 'Hoi,', foot: 'Je krijgt deze e-mail omdat dit adres bij BAO is gebruikt.', privacy: 'Privacy',
        cSub: 'Bevestig je e-mail voor BAO 🐼', cHead: 'Welkom bij BAO 💚',
        cP: ['Je account is klaar. Bevestig dat dit e-mailadres van jou is, zodat we je kunnen helpen als je je wachtwoord vergeet.',
             'Eén keer per dag vraagt Bao hoe je lichaam zich voelde, waar en hoe sterk. Je mag elke vraag leeg laten.'],
        cBtn: 'Mijn e-mail bevestigen', cSmall: ['De link werkt 7 dagen.', 'Heb je dit account niet gemaakt? Negeer deze e-mail dan.', 'BAO is een dagboek, geen medisch hulpmiddel. Bel in een noodgeval 112.'],
        rSub: 'Je nieuwe BAO-wachtwoord 🐼', rHead: 'Kies een nieuw wachtwoord',
        rP: ['Iemand vroeg om het wachtwoord van je BAO-account te wijzigen.'], rBtn: 'Nieuw wachtwoord kiezen',
        rSmall: ['De link werkt 30 minuten en maar één keer.', 'Was jij het niet? Negeer deze e-mail: je wachtwoord blijft hetzelfde.'] }
};

function layout(env, request, lang, t, { heading, greet, paragraphs, button, link, small }){
  const b = base(env, request);
  return '<!doctype html><html><body style="margin:0;background:#f5f8f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#24333b">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #dfe7e6;border-radius:18px">' +
    '<tr><td style="padding:28px 28px 8px;text-align:center">' +
    '<img src="' + b + '/icons/icon-192.png" width="72" height="72" alt="Bao" style="border-radius:18px;display:inline-block">' +
    '<div style="font-size:22px;font-weight:bold;color:#0d5e5b;margin-top:10px">BAO</div></td></tr>' +
    '<tr><td style="padding:8px 28px 4px"><h1 style="font-size:20px;margin:0 0 12px;color:#24333b">' + heading + '</h1>' +
    '<p style="font-size:15px;line-height:1.55;margin:0 0 12px;color:#3d4d54">' + greet + '</p>' +
    paragraphs.map(p => '<p style="font-size:15px;line-height:1.55;margin:0 0 12px;color:#3d4d54">' + p + '</p>').join('') +
    '<p style="margin:22px 0;text-align:center"><a href="' + esc(link) + '" style="background:#187d78;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:11px;font-weight:bold;display:inline-block">' + button + '</a></p>' +
    small.map(p => '<p style="font-size:13px;line-height:1.5;margin:0 0 8px;color:#687880">' + p + '</p>').join('') +
    '</td></tr><tr><td style="padding:14px 28px 24px;font-size:12px;color:#8a979c;border-top:1px solid #eef2f1">' + t.foot +
    ' <a href="' + b + '/privacy.html' + (lang === 'de' ? '#de' : '') + '" style="color:#187d78">' + t.privacy + '</a></td></tr></table></td></tr></table></body></html>';
}

// account closing (the therapist ended it, or the patient said no to a new one) and hand-over to a new therapist.
// Paragraphs are functions: x(date), tr(from, to). The values arrive already escaped for the HTML version.
const T2 = {
  en: { xSub: 'Your BAO diary will close soon 🐼', xHead: 'Your BAO account is closing',
        xP: d => ['Sharing with your therapist or doctor has ended, so your BAO account is closing. Nobody else can read your diary any more.',
                  'You can still open BAO and read or save your check-ins until ' + d + '. After that day everything is deleted.'],
        xBtn: 'Open my diary', xSmall: ['If your therapist or doctor gives you a new code for this email before then, your diary opens again with the same password.', 'BAO is a diary, not a medical device. In an emergency, call 112.'],
        tSub: 'A new therapist for your BAO diary 🐼', tHead: 'Who may read your diary?',
        tP: (f, n) => [(f ? f + ' has' : 'Your therapist has') + ' handed your care over to ' + (n || 'another therapist') + '.',
                       'Until you say yes, nobody reads your diary. Open BAO to choose whether ' + (n || 'the new therapist') + ' may read your check-ins.'],
        tBtn: 'Open BAO and decide', tSmall: ['If you say no, your account closes and you have 30 days to save your diary.'] },
  de: { xSub: 'Dein BAO-Tagebuch wird bald geschlossen 🐼', xHead: 'Dein BAO-Konto wird geschlossen',
        xP: d => ['Das Teilen mit deiner Therapeutin, deinem Therapeuten oder deiner Ärztin bzw. deinem Arzt ist beendet, deshalb wird dein BAO-Konto geschlossen. Niemand sonst kann dein Tagebuch mehr lesen.',
                  'Bis zum ' + d + ' kannst du BAO noch öffnen und deine Check-ins lesen oder speichern. Danach wird alles gelöscht.'],
        xBtn: 'Mein Tagebuch öffnen', xSmall: ['Bekommst du vorher einen neuen Code für diese E-Mail, öffnet sich dein Tagebuch wieder mit demselben Passwort.', 'BAO ist ein Tagebuch, kein Medizinprodukt. Im Notfall wähle die 112.'],
        tSub: 'Neue Begleitung für dein BAO-Tagebuch 🐼', tHead: 'Wer darf dein Tagebuch lesen?',
        tP: (f, n) => [(f || 'Deine bisherige Begleitung') + ' hat deine Behandlung an ' + (n || 'eine andere Person') + ' übergeben.',
                       'Solange du nicht zustimmst, liest niemand dein Tagebuch. Öffne BAO und entscheide, ob ' + (n || 'die neue Person') + ' deine Check-ins lesen darf.'],
        tBtn: 'BAO öffnen und entscheiden', tSmall: ['Sagst du nein, wird dein Konto geschlossen und du hast 30 Tage Zeit, dein Tagebuch zu speichern.'] },
  it: { xSub: 'Il tuo diario BAO sta per chiudersi 🐼', xHead: 'Il tuo account BAO si sta chiudendo',
        xP: d => ['La condivisione con chi ti segue (terapeuta o medico) è terminata, quindi il tuo account BAO si sta chiudendo. Nessun altro può più leggere il tuo diario.',
                  'Puoi ancora aprire BAO e leggere o salvare i tuoi check-in fino al ' + d + '. Dopo quella data verrà cancellato tutto.'],
        xBtn: 'Apri il mio diario', xSmall: ['Se prima di allora ricevi un nuovo codice per questa email, il diario si riapre con la stessa password.', 'BAO è un diario, non un dispositivo medico. In caso di emergenza chiama il 112.'],
        tSub: 'Una nuova persona per il tuo diario BAO 🐼', tHead: 'Chi può leggere il tuo diario?',
        tP: (f, n) => [(f || 'Chi ti seguiva') + ' ha affidato il tuo percorso a ' + (n || 'un’altra persona') + '.',
                       'Finché non dici di sì, nessuno legge il tuo diario. Apri BAO per scegliere se ' + (n || 'la nuova persona') + ' può leggere i tuoi check-in.'],
        tBtn: 'Apri BAO e scegli', tSmall: ['Se dici di no, il tuo account si chiude e hai 30 giorni per salvare il diario.'] },
  fr: { xSub: 'Ton journal BAO va bientôt fermer 🐼', xHead: 'Ton compte BAO se ferme',
        xP: d => ['Le partage avec ton ou ta thérapeute ou ton médecin est terminé, donc ton compte BAO se ferme. Personne d’autre ne peut plus lire ton journal.',
                  'Tu peux encore ouvrir BAO et lire ou enregistrer tes check-ins jusqu’au ' + d + '. Ensuite, tout est supprimé.'],
        xBtn: 'Ouvrir mon journal', xSmall: ['Si tu reçois un nouveau code pour cet e-mail avant cette date, ton journal se rouvre avec le même mot de passe.', 'BAO est un journal, pas un dispositif médical. En cas d’urgence, appelle le 112.'],
        tSub: 'Un nouveau suivi pour ton journal BAO 🐼', tHead: 'Qui peut lire ton journal ?',
        tP: (f, n) => [(f || 'La personne qui te suivait') + ' a confié ton suivi à ' + (n || 'quelqu’un d’autre') + '.',
                       'Tant que tu ne dis pas oui, personne ne lit ton journal. Ouvre BAO pour choisir si ' + (n || 'cette personne') + ' peut lire tes check-ins.'],
        tBtn: 'Ouvrir BAO et choisir', tSmall: ['Si tu dis non, ton compte se ferme et tu as 30 jours pour enregistrer ton journal.'] },
  es: { xSub: 'Tu diario de BAO se cerrará pronto 🐼', xHead: 'Tu cuenta de BAO se está cerrando',
        xP: d => ['Se terminó la conexión con quien te acompaña (terapeuta o médico), así que tu cuenta de BAO se está cerrando. Nadie más puede leer tu diario.',
                  'Aún puedes abrir BAO y leer o guardar tus check-ins hasta el ' + d + '. Después se borrará todo.'],
        xBtn: 'Abrir mi diario', xSmall: ['Si antes de esa fecha recibes un código nuevo para este correo, tu diario se abre otra vez con la misma contraseña.', 'BAO es un diario, no un dispositivo médico. En una emergencia, llama al 112.'],
        tSub: 'Un nuevo acompañamiento para tu diario de BAO 🐼', tHead: '¿Quién puede leer tu diario?',
        tP: (f, n) => [(f || 'Quien te acompañaba') + ' ha pasado tu seguimiento a ' + (n || 'otra persona') + '.',
                       'Hasta que digas que sí, nadie lee tu diario. Abre BAO para elegir si ' + (n || 'la nueva persona') + ' puede leer tus check-ins.'],
        tBtn: 'Abrir BAO y elegir', tSmall: ['Si dices que no, tu cuenta se cierra y tienes 30 días para guardar tu diario.'] },
  pt: { xSub: 'Seu diário do BAO vai fechar em breve 🐼', xHead: 'Sua conta BAO está sendo encerrada',
        xP: d => ['O compartilhamento com quem acompanha você (terapeuta ou médico) terminou, então sua conta BAO está sendo encerrada. Ninguém mais pode ler seu diário.',
                  'Você ainda pode abrir o BAO e ler ou salvar seus check-ins até ' + d + '. Depois disso, tudo é apagado.'],
        xBtn: 'Abrir meu diário', xSmall: ['Se antes disso você receber um novo código para este e-mail, o diário abre de novo com a mesma senha.', 'O BAO é um diário, não um dispositivo médico. Em uma emergência, ligue para o número de emergência.'],
        tSub: 'Um novo acompanhamento para seu diário BAO 🐼', tHead: 'Quem pode ler seu diário?',
        tP: (f, n) => [(f || 'Quem acompanhava você') + ' passou seu acompanhamento para ' + (n || 'outra pessoa') + '.',
                       'Até você dizer sim, ninguém lê seu diário. Abra o BAO para escolher se ' + (n || 'a nova pessoa') + ' pode ler seus check-ins.'],
        tBtn: 'Abrir o BAO e escolher', tSmall: ['Se você disser não, sua conta é encerrada e você tem 30 dias para salvar o diário.'] },
  nl: { xSub: 'Je BAO-dagboek sluit binnenkort 🐼', xHead: 'Je BAO-account wordt gesloten',
        xP: d => ['Het delen met je therapeut of arts is gestopt, daarom wordt je BAO-account gesloten. Niemand anders kan je dagboek nog lezen.',
                  'Tot ' + d + ' kun je BAO nog openen en je check-ins lezen of bewaren. Daarna wordt alles verwijderd.'],
        xBtn: 'Mijn dagboek openen', xSmall: ['Krijg je vóór die datum een nieuwe code voor dit e-mailadres, dan gaat je dagboek weer open met hetzelfde wachtwoord.', 'BAO is een dagboek, geen medisch hulpmiddel. Bel in een noodgeval 112.'],
        tSub: 'Een nieuwe begeleider voor je BAO-dagboek 🐼', tHead: 'Wie mag je dagboek lezen?',
        tP: (f, n) => [(f || 'Je begeleider') + ' heeft je begeleiding overgedragen aan ' + (n || 'iemand anders') + '.',
                       'Zolang je geen ja zegt, leest niemand je dagboek. Open BAO om te kiezen of ' + (n || 'de nieuwe begeleider') + ' je check-ins mag lezen.'],
        tBtn: 'BAO openen en kiezen', tSmall: ['Zeg je nee, dan wordt je account gesloten en heb je 30 dagen om je dagboek te bewaren.'] }
};

function build(env, request, lang, name, link, kind, args = []){
  const t = T[lang] || T.en;
  const t2 = T2[lang] || T2.en;
  const plain = String(name || '').trim().slice(0, 24);
  const greet = t.hi(esc(plain));
  const c = {
    confirm:  { subject: t.cSub,  heading: t.cHead,  paragraphs: () => t.cP,       button: t.cBtn,  small: t.cSmall },
    reset:    { subject: t.rSub,  heading: t.rHead,  paragraphs: () => t.rP,       button: t.rBtn,  small: t.rSmall },
    closing:  { subject: t2.xSub, heading: t2.xHead, paragraphs: a => t2.xP(...a), button: t2.xBtn, small: t2.xSmall },
    transfer: { subject: t2.tSub, heading: t2.tHead, paragraphs: a => t2.tP(...a), button: t2.tBtn, small: t2.tSmall }
  }[kind];
  const clip = a => a.map(x => String(x || '').trim().slice(0, 60));
  return {
    subject: c.subject,
    link,
    html: layout(env, request, lang, t, { heading: c.heading, greet, paragraphs: c.paragraphs(clip(args).map(esc)), button: c.button, link, small: c.small }),
    text: t.hi(plain) + '\n\n' + c.paragraphs(clip(args)).join('\n\n') + '\n\n' + c.button + ': ' + link + '\n\n' + c.small.join('\n')
  };
}

export const mailConfirm  = (env, request, lang, name, link) => build(env, request, lang, name, link, 'confirm');
export const mailReset    = (env, request, lang, name, link) => build(env, request, lang, name, link, 'reset');
// date: the last day the diary can be read, already formatted for the language
export const mailClosing  = (env, request, lang, name, link, date) => build(env, request, lang, name, link, 'closing', [date]);
// from / to: names of the old and the new therapist or doctor (may be empty)
export const mailTransfer = (env, request, lang, name, link, from, to) => build(env, request, lang, name, link, 'transfer', [from, to]);
