// Le frasi di Bao (prima erano in patterns_bao_salute.py).
// Per aggiungere o cambiare una risposta modifica questo file e rifai il deploy.
// Ogni voce e' [ espressione regolare, risposte ] oppure [ espressione regolare, zona del corpo ].
// Le espressioni sono le stesse di Python: \\b = inizio/fine parola, | = "oppure".

export const PATTERNS = [
  [
    "\\b(head ?ache|migraine|head is pounding|my head hurts)\\b",
    [
      "Headaches can be exhausting. Thank you for telling me. Does it throb, press, or stab?",
      "I hear you. Head pain takes a lot of energy to carry. How long did it last?",
      "Noted. Let us look at it together, gently. Is it steady, or does it come in waves?"
    ]
  ],
  [
    "\\b(dizzy|dizziness|light ?headed|vertigo|room is spinning)\\b",
    [
      "Feeling unsteady is unsettling. I am glad you wrote it down. Does the room spin, or do you feel like fainting?",
      "Thank you for noticing that. Dizziness is easy to dismiss. How long does one episode last?"
    ]
  ],
  [
    "\\b(brain fog|foggy|cannot concentrate|can\\'t concentrate|cannot focus|can\\'t focus|forgetful)\\b",
    [
      "Fog is a real symptom, not laziness. Is it like being slowed down, or like being absent?",
      "Thank you for naming it. Has it lasted minutes, hours, or all day?"
    ]
  ],
  [
    "\\b(blurred vision|blurry|eye strain|eyes hurt|sensitive to light|photophobia)\\b",
    [
      "Eyes get tired before we admit it. Does it burn, ache, or feel gritty?",
      "Noted. How long have they felt like this?"
    ]
  ],
  [
    "\\b(jaw|clenching|clench|grinding|bruxism|teeth grinding)\\b",
    [
      "The jaw holds a lot that we do not say out loud. Is it a dull ache, or a sharp pull when you open it?",
      "Thank you for logging it. Has it been there since you woke up?"
    ]
  ],
  [
    "\\b(lump in my throat|throat feels tight|tight throat|hard to swallow|choking feeling)\\b",
    [
      "That sensation is frightening and very common with tension. Does it feel like pressure, or like something stuck?",
      "Thank you for trusting me with it. Is it constant, or does it come and go?"
    ]
  ],
  [
    "\\b(neck|stiff neck|my neck)\\b",
    [
      "The neck holds a lot of tension. Thank you for noticing it. Is it stiff, sore, or burning?",
      "Noted. Necks often carry what the rest of us cannot say. How long has it felt like this?"
    ]
  ],
  [
    "\\b(shoulders?|tight shoulders|shoulder pain)\\b",
    [
      "Shoulders often tighten before we notice we are stressed. Does it feel like a knot, or like a weight?",
      "Thank you. Let us keep track of when they tighten. Is it easing off, or building up?"
    ]
  ],
  [
    "\\b(chest|chest pain|tight chest|heart racing|palpitations|heart is pounding|skipped beat)\\b",
    [
      "That sounds frightening. Thank you for trusting me with it. Is it tight, sharp, or fluttering?",
      "Noted carefully. Chest sensations deserve attention. Did it come suddenly, or build up slowly?"
    ]
  ],
  [
    "\\b(breath|breathing|short of breath|cannot breathe|can\\'t breathe|hyperventilat)\\b",
    [
      "Breathing troubles are scary. I am here. Is it hard to breathe in, or to breathe out?",
      "Thank you for telling me. How long did that feeling last?"
    ]
  ],
  [
    "\\b(stomach|belly|tummy|nausea|nauseous|sick to my stomach|queasy)\\b",
    [
      "The stomach often reacts before the mind does. Is it cramping, burning, or a knot?",
      "Thank you. Gut feelings are real feelings. Does it come in waves, or stay?"
    ]
  ],
  [
    "\\b(bloated|bloating|gas|cramps|ibs|constipat|diarrh)\\b",
    [
      "Digestion carries stress very directly. Is it tight and full, or sharp and gripping?",
      "Thank you for logging it. How many hours has it lasted?"
    ]
  ],
  [
    "\\b(no appetite|not hungry|lost my appetite|cannot eat|can\\'t eat|eating too much)\\b",
    [
      "Appetite changing is worth noticing. Is it disgust at food, or simply no signal at all?",
      "Thank you for telling me. Has it been today only, or for a few days?"
    ]
  ],
  [
    "\\b(lower back|low back|lumbar)\\b",
    [
      "The lower back complains when we hold a position too long. Is it a dull ache, or a sharp catch?",
      "Noted. Does it ease when you move, or get worse?"
    ]
  ],
  [
    "\\b(upper back|between my shoulder ?blades|shoulder ?blade)\\b",
    [
      "That spot tightens with stress and with screens. Does it feel like a knot, or like burning?",
      "Thank you. Has it been there for hours, or for days?"
    ]
  ],
  [
    "\\b(back hurts|my back|backache|hips?|pelvis)\\b",
    [
      "Thank you for noting it. Is it stiff, aching, or shooting?",
      "Noted. Is it constant, or only in certain movements?"
    ]
  ],
  [
    "\\b(tingl|pins and needles|numb|numbness|my arm falls asleep)\\b",
    [
      "Tingling is worth writing down carefully. Is it prickling, buzzing, or completely without feeling?",
      "Thank you for noticing. How long does it take to fade?"
    ]
  ],
  [
    "\\b(legs? hurt|heavy legs|restless legs|cramp in my leg|calf)\\b",
    [
      "Legs carry the whole day. Do they feel heavy, achy, or restless?",
      "Noted. Is it worse the longer you stay still?"
    ]
  ],
  [
    "\\b(hands?|wrists?|fingers?)\\b",
    [
      "Hands tell us a lot. Is it pain, stiffness, or tingling?",
      "Thank you for logging it. Does it last minutes, or all day?"
    ]
  ],
  [
    "\\b(tremor|tremors|shaking|shaky|tic|tics|twitch|spasm|jerk)\\b",
    [
      "Thank you for describing that. Movements can be hard to put into words. Is it fine and fast, or slow and wide?",
      "Noted. How long did it keep going?"
    ]
  ],
  [
    "\\b(itch|itchy|rash|hives|eczema|skin)\\b",
    [
      "Skin often reacts to stress before we do. Does it itch, burn, or sting?",
      "Thank you for noting it. Did it appear in minutes, or slowly over the day?"
    ]
  ],
  [
    "\\b(sweating|sweaty|hot flush|hot flash|cold hands|shivering|chills)\\b",
    [
      "Temperature changes count too. Is it a wave of heat, or a cold that will not leave?",
      "Noted. How long did it take to pass?"
    ]
  ],
  [
    "\\b(tired|exhausted|fatigue|no energy|drained|worn out)\\b",
    [
      "Tiredness counts as a symptom too. I am glad you logged it. Is it the body heavy, or the mind empty?",
      "Thank you. Being drained is information, not weakness. Has it lasted hours, or days?"
    ]
  ],
  [
    "\\b(cannot sleep|can\\'t sleep|insomnia|slept badly|awake all night|waking up|nightmare)\\b",
    [
      "Sleep changes everything else. Thank you for noting it. Was it falling asleep or staying asleep?",
      "Noted. We will watch how sleep and the other symptoms move together. How many hours did you get?"
    ]
  ],
  [
    "\\b(pain|hurts|ache|aching|sore|burning|stabbing|throbbing)\\b",
    [
      "I am sorry you are in pain. Thank you for writing it down. Is it sharp, dull, burning, or pressing?",
      "Noted. Naming the pain is already a step. Is it constant, or does it come in waves?",
      "Thank you for telling me. How long did it last?"
    ]
  ],
  [
    "\\b(panic attack|panicking|panic)\\b",
    [
      "A panic attack takes everything out of you. How long did it last before it started to fade?",
      "Thank you for telling me. What did your body do, racing heart, shaking, cold sweat?"
    ]
  ],
  [
    "\\b(anxious|anxiety|worried|nervous|on edge|restless)\\b",
    [
      "Anxiety and the body are closely linked. Thank you for sharing. Does it feel like buzzing, pressure, or a knot?",
      "I hear you. Has it been there for minutes, or all day?"
    ]
  ],
  [
    "\\b(overwhelm|too much|cannot cope|can\\'t cope|burn ?out|breaking point)\\b",
    [
      "That is a lot to hold. Thank you for saying it out loud. Does it feel like heaviness, or like static?",
      "I hear you. How long have you been carrying it like this?"
    ]
  ],
  [
    "\\b(angry|anger|irritable|frustrated|snapped|rage)\\b",
    [
      "Anger is information too, not a failure. Did your body heat up, tighten, or shake?",
      "Thank you for logging it. How long did it take to settle?"
    ]
  ],
  [
    "\\b(numb|empty|detached|not real|dissociat|far away)\\b",
    [
      "Feeling distant from things is worth noting gently. Is it like fog, or like watching from outside?",
      "Thank you for telling me. How long did it last?"
    ]
  ],
  [
    "\\b(sad|down|low|crying|cried|hopeless|lonely)\\b",
    [
      "Thank you for telling me. That takes something. Does it sit heavy in the chest, or feel more like emptiness?",
      "I am here. We can go slowly. Has it been today only, or for a while?"
    ]
  ]
];

export const ZONES = [
  [
    "\\b(head ?ache|migraine|dizzy|dizziness|vertigo|brain fog|blurred vision|eye strain|jaw|clench|grinding)\\b",
    "head"
  ],
  [
    "\\b(neck|lump in my throat|tight throat|hard to swallow)\\b",
    "neck"
  ],
  [
    "\\bshoulders?\\b",
    "left shoulder"
  ],
  [
    "\\b(chest|palpitations|breath|heart racing|heart is pounding)\\b",
    "chest"
  ],
  [
    "\\b(stomach|belly|tummy|nausea|bloated|bloating|cramps|appetite)\\b",
    "stomach"
  ],
  [
    "\\b(upper back|shoulder ?blade)\\b",
    "upper back"
  ],
  [
    "\\b(lower back|low back|lumbar)\\b",
    "lower back"
  ],
  [
    "\\b(hips?|pelvis)\\b",
    "hips"
  ],
  [
    "\\b(hands?|wrists?|fingers?)\\b",
    "left hand"
  ],
  [
    "\\b(legs? hurt|heavy legs|restless legs|calf)\\b",
    "left lower leg"
  ]
];

export const PATTERNS_DE = [
  [
    "kopfschmerz|kopfweh|migräne|mein kopf (tut|hämmert|dröhnt|pocht)|brummschädel",
    [
      "Kopfschmerzen können sehr erschöpfend sein. Danke, dass du es mir erzählst. Pocht, drückt oder sticht es?",
      "Ich höre dich. Kopfschmerzen kosten viel Kraft. Wie lange geht das schon so?",
      "Notiert. Schauen wir es uns gemeinsam und behutsam an. Ist es gleichbleibend, oder kommt es in Wellen?"
    ]
  ],
  [
    "schwindel|benommen|mir dreht sich|alles dreht sich",
    [
      "Sich unsicher zu fühlen ist beunruhigend. Gut, dass du es aufgeschrieben hast. Dreht sich der Raum, oder fühlt es sich an, als würdest du ohnmächtig?",
      "Danke, dass du das bemerkst. Schwindel wird leicht abgetan. Wie lange dauert eine Episode?"
    ]
  ],
  [
    "gehirnnebel|brain ?fog|benebelt|nicht konzentrieren|konzentrationsprobleme|unkonzentriert|vergesslich",
    [
      "Nebel im Kopf ist ein echtes Symptom, keine Faulheit. Fühlt es sich eher verlangsamt oder eher abwesend an?",
      "Danke, dass du es benennst. Hielt es Minuten, Stunden oder den ganzen Tag an?"
    ]
  ],
  [
    "verschwommen|augen tun weh|augenschmerz|müde augen|lichtempfindlich|brennende augen|augen brennen",
    [
      "Augen werden müde, bevor wir es uns eingestehen. Brennt es, schmerzt es, oder fühlt es sich sandig an?",
      "Notiert. Wie lange fühlen sie sich schon so an?"
    ]
  ],
  [
    "kiefer|knirsch|zusammenbeißen",
    [
      "Der Kiefer hält vieles fest, was wir nicht laut aussprechen. Ist es ein dumpfer Schmerz oder ein scharfes Ziehen beim Öffnen?",
      "Danke, dass du es festhältst. Ist es schon da, seit du aufgewacht bist?"
    ]
  ],
  [
    "kloß im hals|kloss im hals|enger hals|hals ist eng|hals schnürt|schwer zu schlucken|schluckbeschwerden|würgegefühl",
    [
      "Dieses Gefühl ist beängstigend und bei Anspannung sehr häufig. Fühlt es sich wie Druck an, oder als würde etwas feststecken?",
      "Danke, dass du mir das anvertraust. Ist es ständig da, oder kommt und geht es?"
    ]
  ],
  [
    "nacken|\\bhals\\b|genick",
    [
      "Der Nacken hält viel Anspannung. Danke, dass du es bemerkt hast. Ist er steif, wund, oder brennt er?",
      "Notiert. Der Nacken trägt oft, was wir nicht sagen können. Wie lange fühlt er sich schon so an?"
    ]
  ],
  [
    "oberer rücken|oberen rücken|schulterblatt|schulterblätter",
    [
      "Diese Stelle verspannt sich bei Stress und vor Bildschirmen. Fühlt es sich wie ein Knoten oder wie Brennen an?",
      "Danke. Ist es schon seit Stunden da oder seit Tagen?"
    ]
  ],
  [
    "schulter",
    [
      "Die Schultern spannen sich oft an, bevor wir merken, dass wir gestresst sind. Fühlt es sich wie ein Knoten oder wie ein Gewicht an?",
      "Danke. Lass uns im Blick behalten, wann sie sich verspannen. Lässt es nach, oder wird es stärker?"
    ]
  ],
  [
    "brust|herzrasen|herzklopfen|herzstolpern|herz rast|herz pocht|herz klopft|engegefühl",
    [
      "Das klingt beängstigend. Danke, dass du es mir anvertraust. Ist es eng, stechend oder flatternd?",
      "Sorgfältig notiert. Empfindungen in der Brust verdienen Aufmerksamkeit. Kam es plötzlich, oder hat es sich langsam aufgebaut?"
    ]
  ],
  [
    "atem|atmen|atemnot|kurzatmig|keine luft|hyperventil",
    [
      "Atemprobleme machen Angst. Ich bin da. Fällt dir das Einatmen oder das Ausatmen schwer?",
      "Danke, dass du es mir sagst. Wie lange hat dieses Gefühl angehalten?"
    ]
  ],
  [
    "blähung|aufgebläht|blähbauch|krämpfe|reizdarm|verstopf|durchfall",
    [
      "Die Verdauung trägt Stress sehr direkt. Ist es eng und voll oder scharf und krampfend?",
      "Danke, dass du es festhältst. Wie viele Stunden hat es angehalten?"
    ]
  ],
  [
    "magen|bauch|übelkeit|übel|mir ist schlecht|flau",
    [
      "Der Magen reagiert oft, bevor der Kopf es tut. Krampft es, brennt es, oder ist es ein Knoten?",
      "Danke. Bauchgefühle sind echte Gefühle. Kommt es in Wellen, oder bleibt es?"
    ]
  ],
  [
    "kein appetit|keinen appetit|keinen hunger|kann nichts essen|zu viel gegessen|esse zu viel",
    [
      "Wenn sich der Appetit verändert, lohnt es sich hinzuschauen. Ist es Widerwille gegen Essen oder einfach gar kein Signal?",
      "Danke, dass du es mir erzählst. War es nur heute oder schon ein paar Tage?"
    ]
  ],
  [
    "unterer rücken|unteren rücken|kreuzschmerz|lendenwirbel|ischias",
    [
      "Der untere Rücken beschwert sich, wenn wir zu lange in einer Position bleiben. Ist es ein dumpfer Schmerz oder ein scharfes Stechen?",
      "Notiert. Wird es besser, wenn du dich bewegst, oder schlimmer?"
    ]
  ],
  [
    "rücken|hüfte|becken",
    [
      "Danke, dass du es notierst. Ist es steif, schmerzend oder einschießend?",
      "Notiert. Ist es ständig da oder nur bei bestimmten Bewegungen?"
    ]
  ],
  [
    "kribbel|ameisenlaufen|taubheit|\\btaub\\b|eingeschlafen",
    [
      "Kribbeln lohnt es sich genau aufzuschreiben. Prickelt es, summt es, oder ist es völlig gefühllos?",
      "Danke fürs Bemerken. Wie lange dauert es, bis es nachlässt?"
    ]
  ],
  [
    "beine tun weh|bein tut weh|schwere beine|unruhige beine|restless legs|wade",
    [
      "Die Beine tragen den ganzen Tag. Fühlen sie sich schwer, schmerzend oder unruhig an?",
      "Notiert. Wird es schlimmer, je länger du stillhältst?"
    ]
  ],
  [
    "\\bhand\\b|\\bhände\\b|handgelenk|finger",
    [
      "Hände verraten uns viel. Ist es Schmerz, Steifheit oder Kribbeln?",
      "Danke, dass du es festhältst. Dauert es Minuten oder den ganzen Tag?"
    ]
  ],
  [
    "zittern|zittrig|tremor|\\btics?\\b|zucken|zuckung|krampf|spasmus",
    [
      "Danke, dass du das beschreibst. Bewegungen sind schwer in Worte zu fassen. Ist es fein und schnell oder langsam und weit?",
      "Notiert. Wie lange hat es angehalten?"
    ]
  ],
  [
    "juck|ausschlag|nesselsucht|quaddel|ekzem|\\bhaut\\b",
    [
      "Die Haut reagiert oft auf Stress, bevor wir es tun. Juckt es, brennt es, oder sticht es?",
      "Danke, dass du es notierst. Ist es innerhalb von Minuten aufgetaucht oder langsam über den Tag?"
    ]
  ],
  [
    "schwitz|hitzewallung|kalte hände|frösteln|schüttelfrost|\\bfriere",
    [
      "Temperaturveränderungen zählen auch. Ist es eine Hitzewelle oder eine Kälte, die nicht weggeht?",
      "Notiert. Wie lange hat es gedauert, bis es vorbei war?"
    ]
  ],
  [
    "müde|erschöpf|keine energie|keine kraft|ausgelaugt|kaputt|schlapp",
    [
      "Müdigkeit zählt auch als Symptom. Gut, dass du sie festhältst. Ist der Körper schwer oder der Kopf leer?",
      "Danke. Erschöpft zu sein ist eine Information, keine Schwäche. Hält es seit Stunden oder seit Tagen an?"
    ]
  ],
  [
    "nicht schlafen|schlaflos|schlafstörung|schlecht geschlafen|wach gelegen|aufgewacht|albtraum|alptraum",
    [
      "Schlaf verändert alles andere. Danke, dass du es notierst. Ging es ums Einschlafen oder ums Durchschlafen?",
      "Notiert. Wir schauen, wie sich Schlaf und die anderen Symptome gemeinsam verändern. Wie viele Stunden hast du geschlafen?"
    ]
  ],
  [
    "schmerz|tut weh|\\bweh\\b|\\bwund\\b|brennt|brennen|stechen|sticht|pochen|pocht",
    [
      "Es tut mir leid, dass du Schmerzen hast. Danke, dass du es aufschreibst. Ist es scharf, dumpf, brennend oder drückend?",
      "Notiert. Den Schmerz zu benennen ist schon ein Schritt. Ist er ständig da, oder kommt er in Wellen?",
      "Danke, dass du es mir erzählst. Wie lange geht das schon so?"
    ]
  ],
  [
    "panik",
    [
      "Eine Panikattacke raubt dir alle Kraft. Wie lange hat sie gedauert, bis sie nachließ?",
      "Danke, dass du es mir erzählst. Was hat dein Körper gemacht – Herzrasen, Zittern, kalter Schweiß?"
    ]
  ],
  [
    "ängstlich|angst|sorgen|besorgt|nervös|angespannt|unruhig",
    [
      "Angst und Körper sind eng verbunden. Danke, dass du es teilst. Fühlt es sich wie Summen, Druck oder ein Knoten an?",
      "Ich höre dich. Ist es seit Minuten da oder schon den ganzen Tag?"
    ]
  ],
  [
    "überfordert|überforderung|zu viel|schaffe das nicht|burn ?out|ausgebrannt|am ende",
    [
      "Das ist eine Menge zu tragen. Danke, dass du es aussprichst. Fühlt es sich wie Schwere oder wie Rauschen an?",
      "Ich höre dich. Wie lange trägst du das schon so mit dir?"
    ]
  ],
  [
    "wütend|\\bwut\\b|gereizt|genervt|frustriert|ärger|\\bsauer\\b",
    [
      "Wut ist auch eine Information, kein Versagen. Ist dein Körper heiß geworden, hat er sich angespannt oder gezittert?",
      "Danke, dass du es festhältst. Wie lange hat es gedauert, bis es sich gelegt hat?"
    ]
  ],
  [
    "\\bleer\\b|abgestumpft|losgelöst|nicht real|unwirklich|dissoziat|weit weg",
    [
      "Sich von allem entfernt zu fühlen, verdient einen behutsamen Blick. Ist es wie Nebel, oder als würdest du von außen zuschauen?",
      "Danke, dass du es mir erzählst. Wie lange hat es gedauert?"
    ]
  ],
  [
    "traurig|niedergeschlagen|\\bdown\\b|geweint|weinen|hoffnungslos|einsam|bedrückt",
    [
      "Danke, dass du es mir erzählst. Das braucht Mut. Liegt es schwer auf der Brust, oder fühlt es sich eher wie Leere an?",
      "Ich bin da. Wir können langsam machen. War es nur heute oder schon länger?"
    ]
  ]
];

export const ZONES_DE = [
  [
    "kopfschmerz|kopfweh|migräne|schwindel|benommen|gehirnnebel|verschwommen|augen|kiefer|knirsch",
    "head"
  ],
  [
    "nacken|\\bhals\\b|genick|schluck",
    "neck"
  ],
  [
    "oberer rücken|oberen rücken|schulterblatt",
    "upper back"
  ],
  [
    "schulter",
    "left shoulder"
  ],
  [
    "brust|herzrasen|herzklopfen|atem|atmen|keine luft",
    "chest"
  ],
  [
    "magen|bauch|übelkeit|blähung|aufgebläht|krämpfe|appetit",
    "stomach"
  ],
  [
    "unterer rücken|unteren rücken|kreuzschmerz|lendenwirbel",
    "lower back"
  ],
  [
    "hüfte|becken",
    "hips"
  ],
  [
    "\\bhand\\b|\\bhände\\b|handgelenk|finger",
    "left hand"
  ],
  [
    "beine tun weh|bein tut weh|schwere beine|unruhige beine|wade",
    "left lower leg"
  ]
];
