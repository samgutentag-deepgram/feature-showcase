// The Flux TTS voice catalog, from developers.deepgram.com/docs/flux-tts/voices on 2026-11-12 (the
// tables, verbatim). Every model here was requested live the same day: 266 of 266 came back 200
// with audio on POST /v2/speak. pnpm verify:live requests each one again.
// line: one sentence per language, the same words in each, written for this page (not from the
// docs), kept neutral where the grammar marks the speaker's gender.
export interface Lang {
  name: string
  earlyAccess: boolean
  line: string
}

export interface Voice {
  model: string
  name: string
  lang: string
  featured: boolean
  accent: string
  gender: string
  age: string
  character: string
}

export const LANGS: Lang[] = [
  {
    "name": "English",
    "earlyAccess": false,
    "line": "Hello, thanks for calling. How can I help you today?"
  },
  {
    "name": "Dutch",
    "earlyAccess": false,
    "line": "Hallo, bedankt voor het bellen. Hoe kan ik u vandaag helpen?"
  },
  {
    "name": "Dutch (Flemish)",
    "earlyAccess": false,
    "line": "Hallo, bedankt voor het bellen. Hoe kan ik u vandaag helpen?"
  },
  {
    "name": "French",
    "earlyAccess": false,
    "line": "Bonjour, merci de votre appel. Comment puis-je vous aider aujourd'hui ?"
  },
  {
    "name": "German",
    "earlyAccess": false,
    "line": "Hallo, danke für Ihren Anruf. Wie kann ich Ihnen heute helfen?"
  },
  {
    "name": "German (Swiss)",
    "earlyAccess": false,
    "line": "Grüezi, danke für Ihren Anruf. Wie kann ich Ihnen heute helfen?"
  },
  {
    "name": "Hindi",
    "earlyAccess": false,
    "line": "नमस्ते, कॉल करने के लिए धन्यवाद। बताइए, आज मैं आपकी क्या मदद करूँ?"
  },
  {
    "name": "Italian",
    "earlyAccess": false,
    "line": "Buongiorno, grazie per aver chiamato. Come posso aiutarla oggi?"
  },
  {
    "name": "Japanese",
    "earlyAccess": false,
    "line": "こんにちは、お電話ありがとうございます。本日はどのようなご用件でしょうか。"
  },
  {
    "name": "Portuguese (Brazil)",
    "earlyAccess": false,
    "line": "Olá, agradecemos a sua ligação. Como posso ajudar você hoje?"
  },
  {
    "name": "Portuguese (Portugal)",
    "earlyAccess": false,
    "line": "Olá, agradecemos a sua chamada. Em que posso ajudar hoje?"
  },
  {
    "name": "Russian",
    "earlyAccess": false,
    "line": "Здравствуйте, спасибо за звонок. Чем я могу вам помочь сегодня?"
  },
  {
    "name": "Spanish",
    "earlyAccess": false,
    "line": "Hola, gracias por llamar. ¿En qué puedo ayudarle hoy?"
  },
  {
    "name": "Bengali",
    "earlyAccess": true,
    "line": "নমস্কার, ফোন করার জন্য ধন্যবাদ। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?"
  },
  {
    "name": "Bulgarian",
    "earlyAccess": true,
    "line": "Здравейте, благодарим ви за обаждането. С какво мога да ви помогна днес?"
  },
  {
    "name": "Catalan",
    "earlyAccess": true,
    "line": "Hola, gràcies per trucar. En què el puc ajudar avui?"
  },
  {
    "name": "Chinese (Mandarin)",
    "earlyAccess": true,
    "line": "您好，感谢您的来电。请问今天有什么可以帮您？"
  },
  {
    "name": "Chinese (Taiwanese Mandarin)",
    "earlyAccess": true,
    "line": "您好，感謝您的來電。請問今天有什麼可以幫您？"
  },
  {
    "name": "Chinese (Cantonese)",
    "earlyAccess": true,
    "line": "你好，多謝你打嚟。請問今日有咩可以幫到你？"
  },
  {
    "name": "Croatian",
    "earlyAccess": true,
    "line": "Dobar dan, hvala na pozivu. Kako vam mogu pomoći danas?"
  },
  {
    "name": "Czech",
    "earlyAccess": true,
    "line": "Dobrý den, děkujeme za zavolání. Jak vám dnes mohu pomoci?"
  },
  {
    "name": "Danish",
    "earlyAccess": true,
    "line": "Hej, tak fordi du ringer. Hvordan kan jeg hjælpe dig i dag?"
  },
  {
    "name": "Estonian",
    "earlyAccess": true,
    "line": "Tere, aitäh, et helistasite. Kuidas saan teid täna aidata?"
  },
  {
    "name": "Finnish",
    "earlyAccess": true,
    "line": "Hei, kiitos soitostasi. Miten voin auttaa sinua tänään?"
  },
  {
    "name": "Greek",
    "earlyAccess": true,
    "line": "Γεια σας, ευχαριστούμε για την κλήση σας. Πώς μπορώ να σας βοηθήσω σήμερα;"
  },
  {
    "name": "Gujarati",
    "earlyAccess": true,
    "line": "નમસ્તે, ફોન કરવા બદલ આભાર. આજે હું તમારી શું મદદ કરી શકું?"
  },
  {
    "name": "Hungarian",
    "earlyAccess": true,
    "line": "Jó napot, köszönjük a hívását. Miben segíthetek ma?"
  },
  {
    "name": "Indonesian",
    "earlyAccess": true,
    "line": "Halo, terima kasih sudah menelepon. Ada yang bisa saya bantu hari ini?"
  },
  {
    "name": "Kannada",
    "earlyAccess": true,
    "line": "ನಮಸ್ಕಾರ, ಕರೆ ಮಾಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?"
  },
  {
    "name": "Korean",
    "earlyAccess": true,
    "line": "안녕하세요, 전화해 주셔서 감사합니다. 오늘 무엇을 도와드릴까요?"
  },
  {
    "name": "Latvian",
    "earlyAccess": true,
    "line": "Labdien, paldies par zvanu. Kā es varu jums šodien palīdzēt?"
  },
  {
    "name": "Lithuanian",
    "earlyAccess": true,
    "line": "Laba diena, ačiū, kad paskambinote. Kuo galiu jums šiandien padėti?"
  },
  {
    "name": "Malay",
    "earlyAccess": true,
    "line": "Helo, terima kasih kerana menelefon. Apa yang boleh saya bantu hari ini?"
  },
  {
    "name": "Marathi",
    "earlyAccess": true,
    "line": "नमस्कार, फोन केल्याबद्दल धन्यवाद. आज मी तुमची काय मदत करू?"
  },
  {
    "name": "Norwegian",
    "earlyAccess": true,
    "line": "Hei, takk for at du ringer. Hvordan kan jeg hjelpe deg i dag?"
  },
  {
    "name": "Polish",
    "earlyAccess": true,
    "line": "Dzień dobry, dziękujemy za telefon. W czym mogę dziś pomóc?"
  },
  {
    "name": "Romanian",
    "earlyAccess": true,
    "line": "Bună ziua, vă mulțumim pentru apel. Cu ce vă pot ajuta astăzi?"
  },
  {
    "name": "Slovak",
    "earlyAccess": true,
    "line": "Dobrý deň, ďakujeme za zavolanie. Ako vám dnes môžem pomôcť?"
  },
  {
    "name": "Slovenian",
    "earlyAccess": true,
    "line": "Pozdravljeni, hvala za klic. Kako vam lahko danes pomagam?"
  },
  {
    "name": "Swedish",
    "earlyAccess": true,
    "line": "Hej, tack för att du ringer. Hur kan jag hjälpa dig i dag?"
  },
  {
    "name": "Tagalog",
    "earlyAccess": true,
    "line": "Kumusta, salamat sa pagtawag. Paano ko kayo matutulungan ngayon?"
  },
  {
    "name": "Tamil",
    "earlyAccess": true,
    "line": "வணக்கம், அழைத்ததற்கு நன்றி. இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?"
  },
  {
    "name": "Telugu",
    "earlyAccess": true,
    "line": "నమస్కారం, కాల్ చేసినందుకు ధన్యవాదాలు. ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను?"
  },
  {
    "name": "Turkish",
    "earlyAccess": true,
    "line": "Merhaba, aradığınız için teşekkürler. Bugün size nasıl yardımcı olabilirim?"
  },
  {
    "name": "Ukrainian",
    "earlyAccess": true,
    "line": "Добрий день, дякуємо за дзвінок. Чим я можу вам допомогти сьогодні?"
  },
  {
    "name": "Urdu",
    "earlyAccess": true,
    "line": "السلام علیکم، کال کرنے کا شکریہ۔ آج میں آپ کی کیا مدد کروں؟"
  },
  {
    "name": "Vietnamese",
    "earlyAccess": true,
    "line": "Xin chào, cảm ơn bạn đã gọi. Hôm nay tôi có thể giúp gì cho bạn?"
  }
]

export const VOICES: Voice[] = [
  {
    "model": "flux-hannah-en",
    "name": "Hannah",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Female",
    "age": "Young",
    "character": "Clear, confident, thoughtful, pleasant, nice"
  },
  {
    "model": "flux-kit-en",
    "name": "Kit",
    "lang": "English",
    "featured": true,
    "accent": "British",
    "gender": "Male",
    "age": "Young Adult",
    "character": "Friendly, energetic, thoughtful, calm, helpful"
  },
  {
    "model": "flux-alexis-en",
    "name": "Alexis",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Female",
    "age": "Adult",
    "character": "Clear, professional, calm, caring, empathetic"
  },
  {
    "model": "flux-cliff-en",
    "name": "Cliff",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Male",
    "age": "Mature",
    "character": "Deep, confident, calm, raspy, clear"
  },
  {
    "model": "flux-sienna-en",
    "name": "Sienna",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Female",
    "age": "Young Adult",
    "character": "Clear, professional, calm, warm, caring"
  },
  {
    "model": "flux-cole-en",
    "name": "Cole",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Male",
    "age": "Young",
    "character": "Friendly, clear, interesting, energetic, engaging"
  },
  {
    "model": "flux-brooke-en",
    "name": "Brooke",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Female",
    "age": "Young",
    "character": "Friendly, intelligent, fast, confident, energetic"
  },
  {
    "model": "flux-colin-en",
    "name": "Colin",
    "lang": "English",
    "featured": true,
    "accent": "British",
    "gender": "Male",
    "age": "Adult",
    "character": "Warm, friendly, trustworthy, confident, authoritative"
  },
  {
    "model": "flux-gemma-en",
    "name": "Gemma",
    "lang": "English",
    "featured": true,
    "accent": "British",
    "gender": "Female",
    "age": "Young",
    "character": "Friendly, kind, approachable, caring, happy"
  },
  {
    "model": "flux-haley-en",
    "name": "Haley",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Female",
    "age": "Young Adult",
    "character": "Clear, professional, caring, calm, empathetic"
  },
  {
    "model": "flux-heather-en",
    "name": "Heather",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Female",
    "age": "Young",
    "character": "Clear, engaging, energetic, friendly, thoughtful"
  },
  {
    "model": "flux-miles-en",
    "name": "Miles",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Male",
    "age": "Adult",
    "character": "Clear, calm, professional, confident, sincere"
  },
  {
    "model": "flux-sean-en",
    "name": "Sean",
    "lang": "English",
    "featured": true,
    "accent": "British",
    "gender": "Male",
    "age": "Mature",
    "character": "Friendly, kind, caring, calming"
  },
  {
    "model": "flux-bree-en",
    "name": "Bree",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Female",
    "age": "Mature",
    "character": "Friendly, sweet, kind"
  },
  {
    "model": "flux-brittany-en",
    "name": "Brittany",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Female",
    "age": "Mature",
    "character": "Confident, kind, soft"
  },
  {
    "model": "flux-bruce-en",
    "name": "Bruce",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Male",
    "age": "Adult",
    "character": "Friendly, kind, natural, believable, engaged"
  },
  {
    "model": "flux-conor-en",
    "name": "Conor",
    "lang": "English",
    "featured": false,
    "accent": "British",
    "gender": "Male",
    "age": "Mature",
    "character": "Confident, deep, friendly, relaxed"
  },
  {
    "model": "flux-donovan-en",
    "name": "Donovan",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Male",
    "age": "Adult",
    "character": "Professional, calm, thoughtful"
  },
  {
    "model": "flux-drew-en",
    "name": "Drew",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Male",
    "age": "Adult",
    "character": "Confident, relaxed, soft, young, calm"
  },
  {
    "model": "flux-elise-en",
    "name": "Elise",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Female",
    "age": "Adult",
    "character": "Clear, professional, calm, caring, empathetic"
  },
  {
    "model": "flux-jack-en",
    "name": "Jack",
    "lang": "English",
    "featured": false,
    "accent": "British",
    "gender": "Male",
    "age": "Adult",
    "character": "Confident, thoughtful, friendly, professional, clear"
  },
  {
    "model": "flux-kai-en",
    "name": "Kai",
    "lang": "English",
    "featured": false,
    "accent": "Singaporean",
    "gender": "Male",
    "age": "Young Adult",
    "character": "Clear, calm, professional, knowledgeable, caring"
  },
  {
    "model": "flux-kelsey-en",
    "name": "Kelsey",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Female",
    "age": "Young Adult",
    "character": "Clear, professional, caring, calm, empathetic"
  },
  {
    "model": "flux-maeve-en",
    "name": "Maeve",
    "lang": "English",
    "featured": false,
    "accent": "Irish",
    "gender": "Female",
    "age": "Adult",
    "character": "Friendly, energetic, confident, gentle, calm"
  },
  {
    "model": "flux-marcelo-en",
    "name": "Marcelo",
    "lang": "English",
    "featured": false,
    "accent": "Filipino",
    "gender": "Male",
    "age": "Young Adult",
    "character": "Clear, calm, professional, knowledgeable, caring"
  },
  {
    "model": "flux-marcus-en",
    "name": "Marcus",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Male",
    "age": "Adult",
    "character": "Friendly, helpful, smooth, professional, kind"
  },
  {
    "model": "flux-meena-en",
    "name": "Meena",
    "lang": "English",
    "featured": false,
    "accent": "Indian",
    "gender": "Female",
    "age": "Adult",
    "character": "Empathetic, professional, calm, reassuring, satisfying"
  },
  {
    "model": "flux-meghan-en",
    "name": "Meghan",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Female",
    "age": "Adult",
    "character": "Friendly, nice, energetic, kind, confident"
  },
  {
    "model": "flux-naveen-en",
    "name": "Naveen",
    "lang": "English",
    "featured": false,
    "accent": "Indian",
    "gender": "Male",
    "age": "Adult",
    "character": "Clear, professional, knowledgeable, calm, caring"
  },
  {
    "model": "flux-paige-en",
    "name": "Paige",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Female",
    "age": "Young Adult",
    "character": "Clear, professional, calm, comfortable, caring"
  },
  {
    "model": "flux-priya-en",
    "name": "Priya",
    "lang": "English",
    "featured": false,
    "accent": "Indian",
    "gender": "Female",
    "age": "Adult",
    "character": "Confident, empathetic, professional, calm, reassuring"
  },
  {
    "model": "flux-rufus-en",
    "name": "Rufus",
    "lang": "English",
    "featured": false,
    "accent": "British",
    "gender": "Male",
    "age": "Adult",
    "character": "Friendly, confident, intelligent, gentle, enthusiastic"
  },
  {
    "model": "flux-sharon-en",
    "name": "Sharon",
    "lang": "English",
    "featured": false,
    "accent": "Australian",
    "gender": "Female",
    "age": "Young",
    "character": "Formal, calm, relaxed, confident"
  },
  {
    "model": "flux-tanner-en",
    "name": "Tanner",
    "lang": "English",
    "featured": false,
    "accent": "British",
    "gender": "Male",
    "age": "Adult",
    "character": "Professional, calm, confident"
  },
  {
    "model": "flux-wade-en",
    "name": "Wade",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Male",
    "age": "Adult",
    "character": "Warm, confident, clear, enthusiastic, friendly"
  },
  {
    "model": "flux-wes-en",
    "name": "Wes",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Male",
    "age": "Adult",
    "character": "Thoughtful, friendly, warm, interesting"
  },
  {
    "model": "flux-anouk-nl",
    "name": "Anouk",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-bram-nl",
    "name": "Bram",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-fleur-nl",
    "name": "Fleur",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-irene-nl",
    "name": "Irene",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-luuk-nl",
    "name": "Luuk",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-monique-nl",
    "name": "Monique",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ruben-nl",
    "name": "Ruben",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sanne-nl",
    "name": "Sanne",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-yvonne-nl",
    "name": "Yvonne",
    "lang": "Dutch",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-dirk-nl",
    "name": "Dirk",
    "lang": "Dutch (Flemish)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-lotte-nl",
    "name": "Lotte",
    "lang": "Dutch (Flemish)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-niels-nl",
    "name": "Niels",
    "lang": "Dutch (Flemish)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-veerle-nl",
    "name": "Veerle",
    "lang": "Dutch (Flemish)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-arnaud-fr",
    "name": "Arnaud",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-benoit-fr",
    "name": "Benoit",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-brigitte-fr",
    "name": "Brigitte",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-camille-fr",
    "name": "Camille",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-chloe-fr",
    "name": "Chloe",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-florian-fr",
    "name": "Florian",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-julien-fr",
    "name": "Julien",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mathieu-fr",
    "name": "Mathieu",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pierre-fr",
    "name": "Pierre",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-thierry-fr",
    "name": "Thierry",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-veronique-fr",
    "name": "Veronique",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-yasmine-fr",
    "name": "Yasmine",
    "lang": "French",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-benjamin-de",
    "name": "Benjamin",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-christian-de",
    "name": "Christian",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-janine-de",
    "name": "Janine",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-magdalena-de",
    "name": "Magdalena",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-moritz-de",
    "name": "Moritz",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-nadine-de",
    "name": "Nadine",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rolf-de",
    "name": "Rolf",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sonja-de",
    "name": "Sonja",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sven-de",
    "name": "Sven",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-tobias-de",
    "name": "Tobias",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-verena-de",
    "name": "Verena",
    "lang": "German",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-leonie-de",
    "name": "Leonie",
    "lang": "German (Swiss)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-yannick-de",
    "name": "Yannick",
    "lang": "German (Swiss)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ajay-hi",
    "name": "Ajay",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-anjali-hi",
    "name": "Anjali",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-arjun-hi",
    "name": "Arjun",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-divya-hi",
    "name": "Divya",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jyoti-hi",
    "name": "Jyoti",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-nikhil-hi",
    "name": "Nikhil",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pallavi-hi",
    "name": "Pallavi",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-prachi-hi",
    "name": "Prachi",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rahul-hi",
    "name": "Rahul",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rajesh-hi",
    "name": "Rajesh",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ritu-hi",
    "name": "Ritu",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-shreya-hi",
    "name": "Shreya",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sunita-hi",
    "name": "Sunita",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-vikram-hi",
    "name": "Vikram",
    "lang": "Hindi",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-angela-it",
    "name": "Angela",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-chiara-it",
    "name": "Chiara",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-federico-it",
    "name": "Federico",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-giorgio-it",
    "name": "Giorgio",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-matteo-it",
    "name": "Matteo",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-paola-it",
    "name": "Paola",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rocco-it",
    "name": "Rocco",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sofia-it",
    "name": "Sofia",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-stefano-it",
    "name": "Stefano",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-vincenzo-it",
    "name": "Vincenzo",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-vito-it",
    "name": "Vito",
    "lang": "Italian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ayumi-ja",
    "name": "Ayumi",
    "lang": "Japanese",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-hayato-ja",
    "name": "Hayato",
    "lang": "Japanese",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-nozomi-ja",
    "name": "Nozomi",
    "lang": "Japanese",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sayaka-ja",
    "name": "Sayaka",
    "lang": "Japanese",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-bianca-pt",
    "name": "Bianca",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-bruno-pt",
    "name": "Bruno",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-claudia-pt",
    "name": "Claudia",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-leandro-pt",
    "name": "Leandro",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-marcia-pt",
    "name": "Marcia",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mariana-pt",
    "name": "Mariana",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-marta-pt",
    "name": "Marta",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mateus-pt",
    "name": "Mateus",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-miguel-pt",
    "name": "Miguel",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-renato-pt",
    "name": "Renato",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-roberto-pt",
    "name": "Roberto",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rodrigo-pt",
    "name": "Rodrigo",
    "lang": "Portuguese (Brazil)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-artur-pt",
    "name": "Artur",
    "lang": "Portuguese (Portugal)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-benedita-pt",
    "name": "Benedita",
    "lang": "Portuguese (Portugal)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-catarina-pt",
    "name": "Catarina",
    "lang": "Portuguese (Portugal)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-hugo-pt",
    "name": "Hugo",
    "lang": "Portuguese (Portugal)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pedro-pt",
    "name": "Pedro",
    "lang": "Portuguese (Portugal)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ricardo-pt",
    "name": "Ricardo",
    "lang": "Portuguese (Portugal)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-andrei-ru",
    "name": "Andrei",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-kirill-ru",
    "name": "Kirill",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-maxim-ru",
    "name": "Maxim",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mikhail-ru",
    "name": "Mikhail",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-natalia-ru",
    "name": "Natalia",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-nikolai-ru",
    "name": "Nikolai",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-olga-ru",
    "name": "Olga",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-polina-ru",
    "name": "Polina",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-vladimir-ru",
    "name": "Vladimir",
    "lang": "Russian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-aina-es",
    "name": "Aina",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-alfredo-es",
    "name": "Alfredo",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-carmen-es",
    "name": "Carmen",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-cecilia-es",
    "name": "Cecilia",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-duvan-es",
    "name": "Duvan",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-eduardo-es",
    "name": "Eduardo",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ernesto-es",
    "name": "Ernesto",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-fernanda-es",
    "name": "Fernanda",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-fiorella-es",
    "name": "Fiorella",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-gustavo-es",
    "name": "Gustavo",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jaime-es",
    "name": "Jaime",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-martin-es",
    "name": "Martin",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mauricio-es",
    "name": "Mauricio",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-patricia-es",
    "name": "Patricia",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pilar-es",
    "name": "Pilar",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rafael-es",
    "name": "Rafael",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-tomas-es",
    "name": "Tomas",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-valentina-es",
    "name": "Valentina",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ysabel-es",
    "name": "Ysabel",
    "lang": "Spanish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-afsana-bn",
    "name": "Afsana",
    "lang": "Bengali",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ishrat-bn",
    "name": "Ishrat",
    "lang": "Bengali",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mamun-bn",
    "name": "Mamun",
    "lang": "Bengali",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sabbir-bn",
    "name": "Sabbir",
    "lang": "Bengali",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-shuvo-bn",
    "name": "Shuvo",
    "lang": "Bengali",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sumaiya-bn",
    "name": "Sumaiya",
    "lang": "Bengali",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-desislava-bg",
    "name": "Desislava",
    "lang": "Bulgarian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-gergana-bg",
    "name": "Gergana",
    "lang": "Bulgarian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jordi-ca",
    "name": "Jordi",
    "lang": "Catalan",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-judit-ca",
    "name": "Judit",
    "lang": "Catalan",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-bo-zh",
    "name": "Bo",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-haoran-zh",
    "name": "Haoran",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jian-zh",
    "name": "Jian",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jie-zh",
    "name": "Jie",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-lijuan-zh",
    "name": "Lijuan",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-shufen-zh",
    "name": "Shufen",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-wenbo-zh",
    "name": "Wenbo",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-wenjing-zh",
    "name": "Wenjing",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-zhen-zh",
    "name": "Zhen",
    "lang": "Chinese (Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-chiaying-zh",
    "name": "Chiaying",
    "lang": "Chinese (Taiwanese Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-kuanyu-zh",
    "name": "Kuanyu",
    "lang": "Chinese (Taiwanese Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-yawen-zh",
    "name": "Yawen",
    "lang": "Chinese (Taiwanese Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-yuting-zh",
    "name": "Yuting",
    "lang": "Chinese (Taiwanese Mandarin)",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-manlok-zh",
    "name": "Manlok",
    "lang": "Chinese (Cantonese)",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-dalibor-hr",
    "name": "Dalibor",
    "lang": "Croatian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-danijela-hr",
    "name": "Danijela",
    "lang": "Croatian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-domagoj-hr",
    "name": "Domagoj",
    "lang": "Croatian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jasna-hr",
    "name": "Jasna",
    "lang": "Croatian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-josipa-hr",
    "name": "Josipa",
    "lang": "Croatian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mihaela-hr",
    "name": "Mihaela",
    "lang": "Croatian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-vedran-hr",
    "name": "Vedran",
    "lang": "Croatian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jakub-cs",
    "name": "Jakub",
    "lang": "Czech",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pernille-da",
    "name": "Pernille",
    "lang": "Danish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rasmus-da",
    "name": "Rasmus",
    "lang": "Danish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rikke-da",
    "name": "Rikke",
    "lang": "Danish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-triin-et",
    "name": "Triin",
    "lang": "Estonian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-kirsi-fi",
    "name": "Kirsi",
    "lang": "Finnish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-teemu-fi",
    "name": "Teemu",
    "lang": "Finnish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-kostas-el",
    "name": "Kostas",
    "lang": "Greek",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-bhavna-gu",
    "name": "Bhavna",
    "lang": "Gujarati",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-hetal-gu",
    "name": "Hetal",
    "lang": "Gujarati",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jignesh-gu",
    "name": "Jignesh",
    "lang": "Gujarati",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-bence-hu",
    "name": "Bence",
    "lang": "Hungarian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-eszter-hu",
    "name": "Eszter",
    "lang": "Hungarian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-kinga-hu",
    "name": "Kinga",
    "lang": "Hungarian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-tibor-hu",
    "name": "Tibor",
    "lang": "Hungarian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-dewi-id",
    "name": "Dewi",
    "lang": "Indonesian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-fajar-id",
    "name": "Fajar",
    "lang": "Indonesian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-fitri-id",
    "name": "Fitri",
    "lang": "Indonesian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-rizky-id",
    "name": "Rizky",
    "lang": "Indonesian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-teguh-id",
    "name": "Teguh",
    "lang": "Indonesian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-manjunath-kn",
    "name": "Manjunath",
    "lang": "Kannada",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-eunji-ko",
    "name": "Eunji",
    "lang": "Korean",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-hyunwoo-ko",
    "name": "Hyunwoo",
    "lang": "Korean",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mikyung-ko",
    "name": "Mikyung",
    "lang": "Korean",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-minjun-ko",
    "name": "Minjun",
    "lang": "Korean",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-soojin-ko",
    "name": "Soojin",
    "lang": "Korean",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sungmin-ko",
    "name": "Sungmin",
    "lang": "Korean",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-agnese-lv",
    "name": "Agnese",
    "lang": "Latvian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-edgars-lv",
    "name": "Edgars",
    "lang": "Latvian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-goda-lt",
    "name": "Goda",
    "lang": "Lithuanian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-neringa-lt",
    "name": "Neringa",
    "lang": "Lithuanian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-haziq-ms",
    "name": "Haziq",
    "lang": "Malay",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-izzah-ms",
    "name": "Izzah",
    "lang": "Malay",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pooja-mr",
    "name": "Pooja",
    "lang": "Marathi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pratik-mr",
    "name": "Pratik",
    "lang": "Marathi",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sneha-mr",
    "name": "Sneha",
    "lang": "Marathi",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-erlend-no",
    "name": "Erlend",
    "lang": "Norwegian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-espen-no",
    "name": "Espen",
    "lang": "Norwegian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ida-no",
    "name": "Ida",
    "lang": "Norwegian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-signe-no",
    "name": "Signe",
    "lang": "Norwegian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-silje-no",
    "name": "Silje",
    "lang": "Norwegian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-vegard-no",
    "name": "Vegard",
    "lang": "Norwegian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-bartosz-pl",
    "name": "Bartosz",
    "lang": "Polish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ewa-pl",
    "name": "Ewa",
    "lang": "Polish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-justyna-pl",
    "name": "Justyna",
    "lang": "Polish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-kacper-pl",
    "name": "Kacper",
    "lang": "Polish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-konrad-pl",
    "name": "Konrad",
    "lang": "Polish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-zuzanna-pl",
    "name": "Zuzanna",
    "lang": "Polish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-cosmin-ro",
    "name": "Cosmin",
    "lang": "Romanian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ioana-ro",
    "name": "Ioana",
    "lang": "Romanian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-dominika-sk",
    "name": "Dominika",
    "lang": "Slovak",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-juraj-sk",
    "name": "Juraj",
    "lang": "Slovak",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-gregor-sl",
    "name": "Gregor",
    "lang": "Slovenian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-katja-sl",
    "name": "Katja",
    "lang": "Slovenian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-axel-sv",
    "name": "Axel",
    "lang": "Swedish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-charlotta-sv",
    "name": "Charlotta",
    "lang": "Swedish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-frida-sv",
    "name": "Frida",
    "lang": "Swedish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ludvig-sv",
    "name": "Ludvig",
    "lang": "Swedish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-oskar-sv",
    "name": "Oskar",
    "lang": "Swedish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pontus-sv",
    "name": "Pontus",
    "lang": "Swedish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-wilma-sv",
    "name": "Wilma",
    "lang": "Swedish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jerome-tl",
    "name": "Jerome",
    "lang": "Tagalog",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-jomar-tl",
    "name": "Jomar",
    "lang": "Tagalog",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-liezel-tl",
    "name": "Liezel",
    "lang": "Tagalog",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-noel-tl",
    "name": "Noel",
    "lang": "Tagalog",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-trisha-tl",
    "name": "Trisha",
    "lang": "Tagalog",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-gokul-ta",
    "name": "Gokul",
    "lang": "Tamil",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-kavya-ta",
    "name": "Kavya",
    "lang": "Tamil",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sowmya-ta",
    "name": "Sowmya",
    "lang": "Tamil",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-vinoth-ta",
    "name": "Vinoth",
    "lang": "Tamil",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-pavan-te",
    "name": "Pavan",
    "lang": "Telugu",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ravi-te",
    "name": "Ravi",
    "lang": "Telugu",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-sravani-te",
    "name": "Sravani",
    "lang": "Telugu",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-dilek-tr",
    "name": "Dilek",
    "lang": "Turkish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ecem-tr",
    "name": "Ecem",
    "lang": "Turkish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-emre-tr",
    "name": "Emre",
    "lang": "Turkish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-gizem-tr",
    "name": "Gizem",
    "lang": "Turkish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-mehmet-tr",
    "name": "Mehmet",
    "lang": "Turkish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-serkan-tr",
    "name": "Serkan",
    "lang": "Turkish",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-zeynep-tr",
    "name": "Zeynep",
    "lang": "Turkish",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-denys-uk",
    "name": "Denys",
    "lang": "Ukrainian",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-solomiya-uk",
    "name": "Solomiya",
    "lang": "Ukrainian",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-ambreen-ur",
    "name": "Ambreen",
    "lang": "Urdu",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-usman-ur",
    "name": "Usman",
    "lang": "Urdu",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-hoa-vi",
    "name": "Hoa",
    "lang": "Vietnamese",
    "featured": false,
    "accent": "",
    "gender": "Female",
    "age": "",
    "character": ""
  },
  {
    "model": "flux-minh-vi",
    "name": "Minh",
    "lang": "Vietnamese",
    "featured": false,
    "accent": "",
    "gender": "Male",
    "age": "",
    "character": ""
  }
]
