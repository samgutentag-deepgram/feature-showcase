// The Aura-2 voice catalog, from developers.deepgram.com/docs/tts-models on 2026-11-13 (the
// tables, verbatim; featured voices first in each language, in the docs' order). Every model here
// was requested live the same day on POST /v1/speak and came back 200 with audio. pnpm verify:live
// requests each one again.
// line: one sentence per language, the same words in each, the same lines flux-tts-voices uses.
export interface Lang {
  name: string
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
  useCases: string
}

export const LANGS: Lang[] = [
  {
    "name": "English",
    "line": "Hello, thanks for calling. How can I help you today?"
  },
  {
    "name": "Spanish",
    "line": "Hola, gracias por llamar. ¿En qué puedo ayudarle hoy?"
  },
  {
    "name": "Dutch",
    "line": "Hallo, bedankt voor het bellen. Hoe kan ik u vandaag helpen?"
  },
  {
    "name": "French",
    "line": "Bonjour, merci de votre appel. Comment puis-je vous aider aujourd'hui ?"
  },
  {
    "name": "German",
    "line": "Hallo, danke für Ihren Anruf. Wie kann ich Ihnen heute helfen?"
  },
  {
    "name": "Italian",
    "line": "Buongiorno, grazie per aver chiamato. Come posso aiutarla oggi?"
  },
  {
    "name": "Japanese",
    "line": "こんにちは、お電話ありがとうございます。本日はどのようなご用件でしょうか。"
  }
]

export const VOICES: Voice[] = [
  {
    "model": "aura-2-thalia-en",
    "name": "Thalia",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Clear, Confident, Energetic, Enthusiastic",
    "useCases": "Casual chat, customer service, IVR"
  },
  {
    "model": "aura-2-andromeda-en",
    "name": "Andromeda",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Casual, Expressive, Comfortable",
    "useCases": "Customer service, IVR"
  },
  {
    "model": "aura-2-helena-en",
    "name": "Helena",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Caring, Natural, Positive, Friendly, Raspy",
    "useCases": "IVR, casual chat"
  },
  {
    "model": "aura-2-apollo-en",
    "name": "Apollo",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Confident, Comfortable, Casual",
    "useCases": "Casual chat"
  },
  {
    "model": "aura-2-arcas-en",
    "name": "Arcas",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Natural, Smooth, Clear, Comfortable",
    "useCases": "Customer service, casual chat"
  },
  {
    "model": "aura-2-aries-en",
    "name": "Aries",
    "lang": "English",
    "featured": true,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Warm, Energetic, Caring",
    "useCases": "Casual chat"
  },
  {
    "model": "aura-2-amalthea-en",
    "name": "Amalthea",
    "lang": "English",
    "featured": false,
    "accent": "Filipino",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Engaging, Natural, Cheerful",
    "useCases": "Casual chat"
  },
  {
    "model": "aura-2-asteria-en",
    "name": "Asteria",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Clear, Confident, Knowledgeable, Energetic",
    "useCases": "Advertising"
  },
  {
    "model": "aura-2-athena-en",
    "name": "Athena",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Mature",
    "character": "Calm, Smooth, Professional",
    "useCases": "Storytelling"
  },
  {
    "model": "aura-2-atlas-en",
    "name": "Atlas",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Mature",
    "character": "Enthusiastic, Confident, Approachable, Friendly",
    "useCases": "Advertising"
  },
  {
    "model": "aura-2-aurora-en",
    "name": "Aurora",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Cheerful, Expressive, Energetic",
    "useCases": "Interview"
  },
  {
    "model": "aura-2-callista-en",
    "name": "Callista",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Clear, Energetic, Professional, Smooth",
    "useCases": "IVR"
  },
  {
    "model": "aura-2-cora-en",
    "name": "Cora",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Smooth, Melodic, Caring",
    "useCases": "Storytelling"
  },
  {
    "model": "aura-2-cordelia-en",
    "name": "Cordelia",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Approachable, Warm, Polite",
    "useCases": "Storytelling"
  },
  {
    "model": "aura-2-delia-en",
    "name": "Delia",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Casual, Friendly, Cheerful, Breathy",
    "useCases": "Interview"
  },
  {
    "model": "aura-2-draco-en",
    "name": "Draco",
    "lang": "English",
    "featured": false,
    "accent": "British",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Warm, Approachable, Trustworthy, Baritone",
    "useCases": "Storytelling"
  },
  {
    "model": "aura-2-electra-en",
    "name": "Electra",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Professional, Engaging, Knowledgeable",
    "useCases": "IVR, advertising, customer service"
  },
  {
    "model": "aura-2-harmonia-en",
    "name": "Harmonia",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Empathetic, Clear, Calm, Confident",
    "useCases": "Customer service"
  },
  {
    "model": "aura-2-hera-en",
    "name": "Hera",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Smooth, Warm, Professional",
    "useCases": "Informative"
  },
  {
    "model": "aura-2-hermes-en",
    "name": "Hermes",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Expressive, Engaging, Professional",
    "useCases": "Informative"
  },
  {
    "model": "aura-2-hyperion-en",
    "name": "Hyperion",
    "lang": "English",
    "featured": false,
    "accent": "Australian",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Caring, Warm, Empathetic",
    "useCases": "Interview"
  },
  {
    "model": "aura-2-iris-en",
    "name": "Iris",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Cheerful, Positive, Approachable",
    "useCases": "IVR, advertising, customer service"
  },
  {
    "model": "aura-2-janus-en",
    "name": "Janus",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Southern, Smooth, Trustworthy",
    "useCases": "Storytelling"
  },
  {
    "model": "aura-2-juno-en",
    "name": "Juno",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Natural, Engaging, Melodic, Breathy",
    "useCases": "Interview"
  },
  {
    "model": "aura-2-jupiter-en",
    "name": "Jupiter",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Expressive, Knowledgeable, Baritone",
    "useCases": "Informative"
  },
  {
    "model": "aura-2-luna-en",
    "name": "Luna",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Friendly, Natural, Engaging",
    "useCases": "IVR"
  },
  {
    "model": "aura-2-mars-en",
    "name": "Mars",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Smooth, Patient, Trustworthy, Baritone",
    "useCases": "Customer service"
  },
  {
    "model": "aura-2-minerva-en",
    "name": "Minerva",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Positive, Friendly, Natural",
    "useCases": "Storytelling"
  },
  {
    "model": "aura-2-neptune-en",
    "name": "Neptune",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Professional, Patient, Polite",
    "useCases": "Customer service"
  },
  {
    "model": "aura-2-odysseus-en",
    "name": "Odysseus",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Calm, Smooth, Comfortable, Professional",
    "useCases": "Advertising"
  },
  {
    "model": "aura-2-ophelia-en",
    "name": "Ophelia",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Expressive, Enthusiastic, Cheerful",
    "useCases": "Interview"
  },
  {
    "model": "aura-2-orion-en",
    "name": "Orion",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Approachable, Comfortable, Calm, Polite",
    "useCases": "Informative"
  },
  {
    "model": "aura-2-orpheus-en",
    "name": "Orpheus",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Professional, Clear, Confident, Trustworthy",
    "useCases": "Customer service, storytelling"
  },
  {
    "model": "aura-2-pandora-en",
    "name": "Pandora",
    "lang": "English",
    "featured": false,
    "accent": "British",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Smooth, Calm, Melodic, Breathy",
    "useCases": "IVR, informative"
  },
  {
    "model": "aura-2-phoebe-en",
    "name": "Phoebe",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Energetic, Warm, Casual",
    "useCases": "Customer service"
  },
  {
    "model": "aura-2-pluto-en",
    "name": "Pluto",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Smooth, Calm, Empathetic, Baritone",
    "useCases": "Interview, storytelling"
  },
  {
    "model": "aura-2-saturn-en",
    "name": "Saturn",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Knowledgeable, Confident, Baritone",
    "useCases": "Customer service"
  },
  {
    "model": "aura-2-selene-en",
    "name": "Selene",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Expressive, Engaging, Energetic",
    "useCases": "Informative"
  },
  {
    "model": "aura-2-theia-en",
    "name": "Theia",
    "lang": "English",
    "featured": false,
    "accent": "Australian",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Expressive, Polite, Sincere",
    "useCases": "Informative"
  },
  {
    "model": "aura-2-vesta-en",
    "name": "Vesta",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Natural, Expressive, Patient, Empathetic",
    "useCases": "Customer service, interview, storytelling"
  },
  {
    "model": "aura-2-zeus-en",
    "name": "Zeus",
    "lang": "English",
    "featured": false,
    "accent": "American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Deep, Trustworthy, Smooth",
    "useCases": "IVR"
  },
  {
    "model": "aura-2-celeste-es",
    "name": "Celeste",
    "lang": "Spanish",
    "featured": true,
    "accent": "Colombian",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Clear, Energetic, Positive, Friendly, Enthusiastic",
    "useCases": "Casual Chat, Advertising, IVR"
  },
  {
    "model": "aura-2-estrella-es",
    "name": "Estrella",
    "lang": "Spanish",
    "featured": true,
    "accent": "Mexican",
    "gender": "Feminine",
    "age": "Mature",
    "character": "Approachable, Natural, Calm, Comfortable, Expressive",
    "useCases": "Casual Chat, Interview"
  },
  {
    "model": "aura-2-nestor-es",
    "name": "Nestor",
    "lang": "Spanish",
    "featured": true,
    "accent": "Peninsular",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Calm, Professional, Approachable, Clear, Confident",
    "useCases": "Casual Chat, Customer Service"
  },
  {
    "model": "aura-2-sirio-es",
    "name": "Sirio",
    "lang": "Spanish",
    "featured": false,
    "accent": "Mexican",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Calm, Professional, Comfortable, Empathetic, Baritone",
    "useCases": "Casual Chat, Interview"
  },
  {
    "model": "aura-2-carina-es",
    "name": "Carina",
    "lang": "Spanish",
    "featured": false,
    "accent": "Peninsular",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Professional, Raspy, Energetic, Breathy, Confident",
    "useCases": "Interview, Customer Service, IVR"
  },
  {
    "model": "aura-2-alvaro-es",
    "name": "Alvaro",
    "lang": "Spanish",
    "featured": false,
    "accent": "Peninsular",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Calm, Professional, Clear, Knowledgeable, Approachable",
    "useCases": "Interview, Customer Service"
  },
  {
    "model": "aura-2-diana-es",
    "name": "Diana",
    "lang": "Spanish",
    "featured": false,
    "accent": "Peninsular",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Professional, Confident, Expressive, Polite, Knowledgeable",
    "useCases": "Storytelling, Advertising"
  },
  {
    "model": "aura-2-aquila-es",
    "name": "Aquila",
    "lang": "Spanish",
    "featured": false,
    "accent": "Latin American",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Expressive, Enthusiastic, Confident, Casual, Comfortable",
    "useCases": "Casual Chat, Informative"
  },
  {
    "model": "aura-2-selena-es",
    "name": "Selena",
    "lang": "Spanish",
    "featured": false,
    "accent": "Latin American",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Approachable, Casual, Friendly, Calm, Positive",
    "useCases": "Customer Service, Informative"
  },
  {
    "model": "aura-2-javier-es",
    "name": "Javier",
    "lang": "Spanish",
    "featured": false,
    "accent": "Mexican",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Approachable, Professional, Friendly, Comfortable, Calm",
    "useCases": "Casual Chat, IVR, Storytelling"
  },
  {
    "model": "aura-2-agustina-es",
    "name": "Agustina",
    "lang": "Spanish",
    "featured": false,
    "accent": "Peninsular",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Calm, Clear, Expressive, Knowledgeable, Professional",
    "useCases": "Interview, Casual Chat"
  },
  {
    "model": "aura-2-antonia-es",
    "name": "Antonia",
    "lang": "Spanish",
    "featured": false,
    "accent": "Argentine",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Approachable, Enthusiastic, Friendly, Natural, Professional",
    "useCases": "Customer Service, Interview, Casual Chat"
  },
  {
    "model": "aura-2-gloria-es",
    "name": "Gloria",
    "lang": "Spanish",
    "featured": false,
    "accent": "Colombian",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Casual, Clear, Expressive, Natural, Smooth",
    "useCases": "Customer Service, Casual Chat"
  },
  {
    "model": "aura-2-luciano-es",
    "name": "Luciano",
    "lang": "Spanish",
    "featured": false,
    "accent": "Mexican",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Charismatic, Cheerful, Energetic, Expressive, Friendly",
    "useCases": "Customer Service, Casual Chat"
  },
  {
    "model": "aura-2-olivia-es",
    "name": "Olivia",
    "lang": "Spanish",
    "featured": false,
    "accent": "Mexican",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Breathy, Calm, Casual, Expressive, Warm",
    "useCases": "Customer Service, Casual Chat"
  },
  {
    "model": "aura-2-silvia-es",
    "name": "Silvia",
    "lang": "Spanish",
    "featured": false,
    "accent": "Peninsular",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Charismatic, Clear, Expressive, Natural, Warm",
    "useCases": "Customer Service, Casual Chat"
  },
  {
    "model": "aura-2-valerio-es",
    "name": "Valerio",
    "lang": "Spanish",
    "featured": false,
    "accent": "Mexican",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Deep, Knowledgeable, Natural, Polite, Professional",
    "useCases": "Customer Service, Informative"
  },
  {
    "model": "aura-2-rhea-nl",
    "name": "Rhea",
    "lang": "Dutch",
    "featured": true,
    "accent": "Dutch",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Caring, Knowledgeable, Positive, Smooth, Warm",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-sander-nl",
    "name": "Sander",
    "lang": "Dutch",
    "featured": true,
    "accent": "Dutch",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Calm, Clear, Deep, Professional, Smooth",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-beatrix-nl",
    "name": "Beatrix",
    "lang": "Dutch",
    "featured": true,
    "accent": "Dutch",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Cheerful, Enthusiastic, Friendly, Trustworthy, Warm",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-daphne-nl",
    "name": "Daphne",
    "lang": "Dutch",
    "featured": false,
    "accent": "Dutch",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Calm, Clear, Confident, Professional, Smooth",
    "useCases": "Healthcare, Interview, Casual Chat, Audiobook"
  },
  {
    "model": "aura-2-cornelia-nl",
    "name": "Cornelia",
    "lang": "Dutch",
    "featured": false,
    "accent": "Dutch",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Approachable, Friendly, Polite, Positive, Warm",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-hestia-nl",
    "name": "Hestia",
    "lang": "Dutch",
    "featured": false,
    "accent": "Dutch",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Approachable, Caring, Expressive, Friendly, Knowledgeable",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-lars-nl",
    "name": "Lars",
    "lang": "Dutch",
    "featured": false,
    "accent": "Dutch",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Breathy, Casual, Comfortable, Sincere, Trustworthy",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-roman-nl",
    "name": "Roman",
    "lang": "Dutch",
    "featured": false,
    "accent": "Dutch",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Calm, Casual, Deep, Natural, Patient",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-leda-nl",
    "name": "Leda",
    "lang": "Dutch",
    "featured": false,
    "accent": "Dutch",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Caring, Comfortable, Empathetic, Friendly, Sincere",
    "useCases": "Sales"
  },
  {
    "model": "aura-2-agathe-fr",
    "name": "Agathe",
    "lang": "French",
    "featured": true,
    "accent": "French",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Charismatic, Cheerful, Enthusiastic, Friendly, Natural",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-hector-fr",
    "name": "Hector",
    "lang": "French",
    "featured": true,
    "accent": "French",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Confident, Empathetic, Expressive, Friendly, Patient",
    "useCases": "Customer Service"
  },
  {
    "model": "aura-2-julius-de",
    "name": "Julius",
    "lang": "German",
    "featured": true,
    "accent": "German",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Casual, Cheerful, Engaging, Expressive, Friendly",
    "useCases": "Healthcare, Customer Service, Sales, Financial Services"
  },
  {
    "model": "aura-2-viktoria-de",
    "name": "Viktoria",
    "lang": "German",
    "featured": true,
    "accent": "German",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Charismatic, Cheerful, Enthusiastic, Friendly, Warm",
    "useCases": "Healthcare, Customer Service, Sales, Financial Services"
  },
  {
    "model": "aura-2-elara-de",
    "name": "Elara",
    "lang": "German",
    "featured": false,
    "accent": "German",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Calm, Clear, Natural, Patient, Trustworthy",
    "useCases": "Healthcare, Customer Service, Sales, Financial Services"
  },
  {
    "model": "aura-2-aurelia-de",
    "name": "Aurelia",
    "lang": "German",
    "featured": false,
    "accent": "German",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Approachable, Casual, Comfortable, Natural, Sincere",
    "useCases": "Healthcare, Customer Service, Sales, Financial Services"
  },
  {
    "model": "aura-2-lara-de",
    "name": "Lara",
    "lang": "German",
    "featured": false,
    "accent": "German",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Caring, Cheerful, Empathetic, Expressive, Warm",
    "useCases": "Healthcare, Customer Service, Sales, Financial Services"
  },
  {
    "model": "aura-2-fabian-de",
    "name": "Fabian",
    "lang": "German",
    "featured": false,
    "accent": "German",
    "gender": "Masculine",
    "age": "Mature",
    "character": "Confident, Knowledgeable, Natural, Polite, Professional",
    "useCases": "Healthcare, Customer Service, Sales, Financial Services"
  },
  {
    "model": "aura-2-kara-de",
    "name": "Kara",
    "lang": "German",
    "featured": false,
    "accent": "German",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Caring, Empathetic, Expressive, Professional, Warm",
    "useCases": "Healthcare, Customer Service, Sales, Financial Services"
  },
  {
    "model": "aura-2-livia-it",
    "name": "Livia",
    "lang": "Italian",
    "featured": true,
    "accent": "Italian",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Approachable, Cheerful, Clear, Engaging, Expressive",
    "useCases": "Customer Service, Interview, Audiobook"
  },
  {
    "model": "aura-2-dionisio-it",
    "name": "Dionisio",
    "lang": "Italian",
    "featured": true,
    "accent": "Italian",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Confident, Engaging, Friendly, Melodic, Positive",
    "useCases": "Interview, Casual Chat, Customer Service"
  },
  {
    "model": "aura-2-melia-it",
    "name": "Melia",
    "lang": "Italian",
    "featured": false,
    "accent": "Italian",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Clear, Comfortable, Engaging, Friendly, Natural",
    "useCases": "Casual Chat, Customer Service, Interview"
  },
  {
    "model": "aura-2-elio-it",
    "name": "Elio",
    "lang": "Italian",
    "featured": false,
    "accent": "Italian",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Breathy, Calm, Professional, Smooth, Trustworthy",
    "useCases": "Interview, Casual Chat, Customer Service"
  },
  {
    "model": "aura-2-flavio-it",
    "name": "Flavio",
    "lang": "Italian",
    "featured": false,
    "accent": "Italian",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Confident, Deep, Empathetic, Professional, Trustworthy",
    "useCases": "Casual Chat, Interview, Customer Service"
  },
  {
    "model": "aura-2-maia-it",
    "name": "Maia",
    "lang": "Italian",
    "featured": false,
    "accent": "Italian",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Caring, Energetic, Expressive, Professional, Warm",
    "useCases": "Interview, Casual Chat, Customer Service"
  },
  {
    "model": "aura-2-cinzia-it",
    "name": "Cinzia",
    "lang": "Italian",
    "featured": false,
    "accent": "Italian",
    "gender": "Feminine",
    "age": "Mature",
    "character": "Approachable, Friendly, Smooth, Trustworthy, Warm",
    "useCases": "Customer Service, Interview, Narration"
  },
  {
    "model": "aura-2-cesare-it",
    "name": "Cesare",
    "lang": "Italian",
    "featured": false,
    "accent": "Italian",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Clear, Empathetic, Knowledgeable, Natural, Smooth",
    "useCases": "Casual Chat, Customer Service, Interview, IVR"
  },
  {
    "model": "aura-2-demetra-it",
    "name": "Demetra",
    "lang": "Italian",
    "featured": false,
    "accent": "Italian",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Calm, Comfortable, Patient",
    "useCases": "Casual Chat, Interview, Narration"
  },
  {
    "model": "aura-2-fujin-ja",
    "name": "Fujin",
    "lang": "Japanese",
    "featured": true,
    "accent": "Japanese",
    "gender": "Masculine",
    "age": "Adult",
    "character": "Calm, Confident, Knowledgeable, Professional, Smooth",
    "useCases": "Interview, Casual Chat, IVR"
  },
  {
    "model": "aura-2-izanami-ja",
    "name": "Izanami",
    "lang": "Japanese",
    "featured": true,
    "accent": "Japanese",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Approachable, Clear, Knowledgeable, Polite, Professional",
    "useCases": "Casual Chat, Customer Service, Interview, IVR"
  },
  {
    "model": "aura-2-uzume-ja",
    "name": "Uzume",
    "lang": "Japanese",
    "featured": false,
    "accent": "Japanese",
    "gender": "Feminine",
    "age": "Young Adult",
    "character": "Approachable, Clear, Polite, Professional, Trustworthy",
    "useCases": "Customer Service, Interview, IVR, Commercial"
  },
  {
    "model": "aura-2-ebisu-ja",
    "name": "Ebisu",
    "lang": "Japanese",
    "featured": false,
    "accent": "Japanese",
    "gender": "Masculine",
    "age": "Young Adult",
    "character": "Calm, Deep, Natural, Patient, Sincere",
    "useCases": "Casual Chat, Customer Service"
  },
  {
    "model": "aura-2-ama-ja",
    "name": "Ama",
    "lang": "Japanese",
    "featured": false,
    "accent": "Japanese",
    "gender": "Feminine",
    "age": "Adult",
    "character": "Casual, Comfortable, Confident, Knowledgeable, Natural",
    "useCases": "Interview, IVR"
  }
]
