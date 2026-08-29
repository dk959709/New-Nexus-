export interface EdgeVoice {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  language: string;
  accent: string;
}

export const EDGE_VOICES: EdgeVoice[] = [
  // English (United States)
  { id: 'en-US-AriaNeural', name: 'Aria', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-AnaNeural', name: 'Ana', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-AndrewNeural', name: 'Andrew', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-AshleyNeural', name: 'Ashley', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-BrandonNeural', name: 'Brandon', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-BrianNeural', name: 'Brian', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-CoraNeural', name: 'Cora', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-ElizabethNeural', name: 'Elizabeth', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-EricNeural', name: 'Eric', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-GuyNeural', name: 'Guy', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-JacobNeural', name: 'Jacob', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-JaneNeural', name: 'Jane', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-JasonNeural', name: 'Jason', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-MonicaNeural', name: 'Monica', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-NancyNeural', name: 'Nancy', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-RogerNeural', name: 'Roger', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-SaraNeural', name: 'Sara', gender: 'Female', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', gender: 'Male', language: 'English (United States)', accent: 'en-US' },
  { id: 'en-US-TonyNeural', name: 'Tony', gender: 'Male', language: 'English (United States)', accent: 'en-US' },

  // English (United Kingdom)
  { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'Male', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'Female', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-AlfieNeural', name: 'Alfie', gender: 'Male', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-BellaNeural', name: 'Bella', gender: 'Female', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-ElliotNeural', name: 'Elliot', gender: 'Male', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-HollieNeural', name: 'Hollie', gender: 'Female', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-LibbyNeural', name: 'Libby', gender: 'Female', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-MaisieNeural', name: 'Maisie', gender: 'Female', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-NoahNeural', name: 'Noah', gender: 'Male', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-OliverNeural', name: 'Oliver', gender: 'Male', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-OliviaNeural', name: 'Olivia', gender: 'Female', language: 'English (United Kingdom)', accent: 'en-GB' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', gender: 'Male', language: 'English (United Kingdom)', accent: 'en-GB' },

  // English (Australia)
  { id: 'en-AU-NatashaNeural', name: 'Natasha', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-WilliamNeural', name: 'William', gender: 'Male', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-AnnetteNeural', name: 'Annette', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-CarlyNeural', name: 'Carly', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-DarrenNeural', name: 'Darren', gender: 'Male', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-DuncanNeural', name: 'Duncan', gender: 'Male', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-ElsieNeural', name: 'Elsie', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-FreyaNeural', name: 'Freya', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-JoanneNeural', name: 'Joanne', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-KenNeural', name: 'Ken', gender: 'Male', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-KimNeural', name: 'Kim', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-NeilNeural', name: 'Neil', gender: 'Male', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-TimNeural', name: 'Tim', gender: 'Male', language: 'English (Australia)', accent: 'en-AU' },
  { id: 'en-AU-TinaNeural', name: 'Tina', gender: 'Female', language: 'English (Australia)', accent: 'en-AU' },

  // English (Canada)
  { id: 'en-CA-ClaraNeural', name: 'Clara', gender: 'Female', language: 'English (Canada)', accent: 'en-CA' },
  { id: 'en-CA-LiamNeural', name: 'Liam', gender: 'Male', language: 'English (Canada)', accent: 'en-CA' },

  // English (India)
  { id: 'en-IN-NeerjaNeural', name: 'Neerja', gender: 'Female', language: 'English (India)', accent: 'en-IN' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat', gender: 'Male', language: 'English (India)', accent: 'en-IN' },
  { id: 'en-IN-AnanyaNeural', name: 'Ananya', gender: 'Female', language: 'English (India)', accent: 'en-IN' },
  { id: 'en-IN-AartiNeural', name: 'Aarti', gender: 'Female', language: 'English (India)', accent: 'en-IN' },
  { id: 'en-IN-KavyaNeural', name: 'Kavya', gender: 'Female', language: 'English (India)', accent: 'en-IN' },
  { id: 'en-IN-KunalNeural', name: 'Kunal', gender: 'Male', language: 'English (India)', accent: 'en-IN' },
  { id: 'en-IN-RehaanNeural', name: 'Rehaan', gender: 'Male', language: 'English (India)', accent: 'en-IN' },

  // Hindi (India)
  { id: 'hi-IN-SwaraNeural', name: 'Swara', gender: 'Female', language: 'Hindi (India)', accent: 'hi-IN' },
  { id: 'hi-IN-MadhurNeural', name: 'Madhur', gender: 'Male', language: 'Hindi (India)', accent: 'hi-IN' },
  { id: 'hi-IN-AaravNeural', name: 'Aarav', gender: 'Male', language: 'Hindi (India)', accent: 'hi-IN' },
  { id: 'hi-IN-AnanyaNeural', name: 'Ananya', gender: 'Female', language: 'Hindi (India)', accent: 'hi-IN' },
  { id: 'hi-IN-KavyaNeural', name: 'Kavya', gender: 'Female', language: 'Hindi (India)', accent: 'hi-IN' },
  { id: 'hi-IN-KunalNeural', name: 'Kunal', gender: 'Male', language: 'Hindi (India)', accent: 'hi-IN' },

  // Spanish (Spain)
  { id: 'es-ES-ElviraNeural', name: 'Elvira', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro', gender: 'Male', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-AbrilNeural', name: 'Abril', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-ArnauNeural', name: 'Arnau', gender: 'Male', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-DarioNeural', name: 'Dario', gender: 'Male', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-EliasNeural', name: 'Elias', gender: 'Male', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-EstrellaNeural', name: 'Estrella', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-IreneNeural', name: 'Irene', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-LaiaNeural', name: 'Laia', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-LiaNeural', name: 'Lia', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-NilNeural', name: 'Nil', gender: 'Male', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-SaulNeural', name: 'Saul', gender: 'Male', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-TeoNeural', name: 'Teo', gender: 'Male', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-TrianaNeural', name: 'Triana', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },
  { id: 'es-ES-VeraNeural', name: 'Vera', gender: 'Female', language: 'Spanish (Spain)', accent: 'es-ES' },

  // Spanish (Mexico)
  { id: 'es-MX-DaliaNeural', name: 'Dalia', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge', gender: 'Male', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-BeatrizNeural', name: 'Beatriz', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-CandelaNeural', name: 'Candela', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-CarlotaNeural', name: 'Carlota', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-CesarioNeural', name: 'Cesario', gender: 'Male', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-GaelNeural', name: 'Gael', gender: 'Male', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-KimiNeural', name: 'Kimi', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-LucianoNeural', name: 'Luciano', gender: 'Male', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-MarinaNeural', name: 'Marina', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-NuriaNeural', name: 'Nuria', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-PelayoNeural', name: 'Pelayo', gender: 'Male', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-RenataNeural', name: 'Renata', gender: 'Female', language: 'Spanish (Mexico)', accent: 'es-MX' },
  { id: 'es-MX-YagoNeural', name: 'Yago', gender: 'Male', language: 'Spanish (Mexico)', accent: 'es-MX' },

  // French (France)
  { id: 'fr-FR-DeniseNeural', name: 'Denise', gender: 'Female', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-HenriNeural', name: 'Henri', gender: 'Male', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-AlainNeural', name: 'Alain', gender: 'Male', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-BrigitteNeural', name: 'Brigitte', gender: 'Female', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-CelesteNeural', name: 'Celeste', gender: 'Female', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-ClaudeNeural', name: 'Claude', gender: 'Male', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-CoralieNeural', name: 'Coralie', gender: 'Female', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-JacquelineNeural', name: 'Jacqueline', gender: 'Female', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-JeromeNeural', name: 'Jerome', gender: 'Male', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-JosephineNeural', name: 'Josephine', gender: 'Female', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-MauriceNeural', name: 'Maurice', gender: 'Male', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-YvesNeural', name: 'Yves', gender: 'Male', language: 'French (France)', accent: 'fr-FR' },
  { id: 'fr-FR-YvetteNeural', name: 'Yvette', gender: 'Female', language: 'French (France)', accent: 'fr-FR' },

  // French (Canada)
  { id: 'fr-CA-SylvieNeural', name: 'Sylvie', gender: 'Female', language: 'French (Canada)', accent: 'fr-CA' },
  { id: 'fr-CA-AntoineNeural', name: 'Antoine', gender: 'Male', language: 'French (Canada)', accent: 'fr-CA' },
  { id: 'fr-CA-JeanNeural', name: 'Jean', gender: 'Male', language: 'French (Canada)', accent: 'fr-CA' },
  { id: 'fr-CA-ThierryNeural', name: 'Thierry', gender: 'Male', language: 'French (Canada)', accent: 'fr-CA' },

  // German (Germany)
  { id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'Female', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-ConradNeural', name: 'Conrad', gender: 'Male', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-AmalaNeural', name: 'Amala', gender: 'Female', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-BerndNeural', name: 'Bernd', gender: 'Male', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-ChristophNeural', name: 'Christoph', gender: 'Male', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-ElkeNeural', name: 'Elke', gender: 'Female', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-GiselaNeural', name: 'Gisela', gender: 'Female', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-KlausNeural', name: 'Klaus', gender: 'Male', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-LuisaNeural', name: 'Luisa', gender: 'Female', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-MajaNeural', name: 'Maja', gender: 'Female', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-RalfNeural', name: 'Ralf', gender: 'Male', language: 'German (Germany)', accent: 'de-DE' },
  { id: 'de-DE-TimoNeural', name: 'Timo', gender: 'Male', language: 'German (Germany)', accent: 'de-DE' },

  // Japanese (Japan)
  { id: 'ja-JP-NanamiNeural', name: 'Nanami', gender: 'Female', language: 'Japanese (Japan)', accent: 'ja-JP' },
  { id: 'ja-JP-KeitaNeural', name: 'Keita', gender: 'Male', language: 'Japanese (Japan)', accent: 'ja-JP' },
  { id: 'ja-JP-AoiNeural', name: 'Aoi', gender: 'Female', language: 'Japanese (Japan)', accent: 'ja-JP' },
  { id: 'ja-JP-DaichiNeural', name: 'Daichi', gender: 'Male', language: 'Japanese (Japan)', accent: 'ja-JP' },
  { id: 'ja-JP-MayuNeural', name: 'Mayu', gender: 'Female', language: 'Japanese (Japan)', accent: 'ja-JP' },
  { id: 'ja-JP-NaokiNeural', name: 'Naoki', gender: 'Male', language: 'Japanese (Japan)', accent: 'ja-JP' },
  { id: 'ja-JP-ShioriNeural', name: 'Shiori', gender: 'Female', language: 'Japanese (Japan)', accent: 'ja-JP' },

  // Chinese (Mandarin, Simplified)
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-YunxiNeural', name: 'Yunxi', gender: 'Male', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-YunjianNeural', name: 'Yunjian', gender: 'Male', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaoyangNeural', name: 'Xiaoyang', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaochenNeural', name: 'Xiaochen', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaohanNeural', name: 'Xiaohan', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaomoNeural', name: 'Xiaomo', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaoqiuNeural', name: 'Xiaoqiu', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaoruiNeural', name: 'Xiaorui', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaoshuangNeural', name: 'Xiaoshuang', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaoxuanNeural', name: 'Xiaoxuan', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-XiaoyanNeural', name: 'Xiaoyan', gender: 'Female', language: 'Chinese (Mandarin)', accent: 'zh-CN' },
  { id: 'zh-CN-YouzheNeural', name: 'Youzhe', gender: 'Male', language: 'Chinese (Mandarin)', accent: 'zh-CN' },

  // Arabic (Saudi Arabia)
  { id: 'ar-SA-ZariyahNeural', name: 'Zariyah', gender: 'Female', language: 'Arabic (Saudi Arabia)', accent: 'ar-SA' },
  { id: 'ar-SA-HamedNeural', name: 'Hamed', gender: 'Male', language: 'Arabic (Saudi Arabia)', accent: 'ar-SA' },

  // Portuguese (Brazil)
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', gender: 'Male', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-BrendaNeural', name: 'Brenda', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-DonatoNeural', name: 'Donato', gender: 'Male', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-ElzaNeural', name: 'Elza', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-FabioNeural', name: 'Fabio', gender: 'Male', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-GiovannaNeural', name: 'Giovanna', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-HumbertoNeural', name: 'Humberto', gender: 'Male', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-JulioNeural', name: 'Julio', gender: 'Male', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-LeticiaNeural', name: 'Leticia', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-ManuelaNeural', name: 'Manuela', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-NicolauNeural', name: 'Nicolau', gender: 'Male', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-ValeriaNeural', name: 'Valeria', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },
  { id: 'pt-BR-YaraNeural', name: 'Yara', gender: 'Female', language: 'Portuguese (Brazil)', accent: 'pt-BR' },

  // Italian (Italy)
  { id: 'it-IT-ElsaNeural', name: 'Elsa', gender: 'Female', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-IsabellaNeural', name: 'Isabella', gender: 'Female', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-FilippoNeural', name: 'Filippo', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-DiegoNeural', name: 'Diego', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-BenignoNeural', name: 'Benigno', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-CalimeroNeural', name: 'Calimero', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-CataldoNeural', name: 'Cataldo', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-DomenicaNeural', name: 'Domenica', gender: 'Female', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-GiacomoNeural', name: 'Giacomo', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-GianniNeural', name: 'Gianni', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-ImmacolataNeural', name: 'Immacolata', gender: 'Female', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-LuciaNeural', name: 'Lucia', gender: 'Female', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-PaoloNeural', name: 'Paolo', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-PiaNeural', name: 'Pia', gender: 'Female', language: 'Italian (Italy)', accent: 'it-IT' },
  { id: 'it-IT-VittorioNeural', name: 'Vittorio', gender: 'Male', language: 'Italian (Italy)', accent: 'it-IT' },

  // Russian (Russia)
  { id: 'ru-RU-SvetlanaNeural', name: 'Svetlana', gender: 'Female', language: 'Russian (Russia)', accent: 'ru-RU' },
  { id: 'ru-RU-DmitryNeural', name: 'Dmitry', gender: 'Male', language: 'Russian (Russia)', accent: 'ru-RU' },
  { id: 'ru-RU-ImmanuelNeural', name: 'Immanuel', gender: 'Male', language: 'Russian (Russia)', accent: 'ru-RU' },

  // Korean (South Korea)
  { id: 'ko-KR-SunHiNeural', name: 'SunHi', gender: 'Female', language: 'Korean (South Korea)', accent: 'ko-KR' },
  { id: 'ko-KR-InJoonNeural', name: 'InJoon', gender: 'Male', language: 'Korean (South Korea)', accent: 'ko-KR' },
  { id: 'ko-KR-BongJinNeural', name: 'BongJin', gender: 'Male', language: 'Korean (South Korea)', accent: 'ko-KR' },
  { id: 'ko-KR-GookMinNeural', name: 'GookMin', gender: 'Male', language: 'Korean (South Korea)', accent: 'ko-KR' },
  { id: 'ko-KR-JiMinNeural', name: 'JiMin', gender: 'Female', language: 'Korean (South Korea)', accent: 'ko-KR' },
  { id: 'ko-KR-SeoHyeonNeural', name: 'SeoHyeon', gender: 'Female', language: 'Korean (South Korea)', accent: 'ko-KR' },
  { id: 'ko-KR-SoonBokNeural', name: 'SoonBok', gender: 'Female', language: 'Korean (South Korea)', accent: 'ko-KR' },
  { id: 'ko-KR-YuJinNeural', name: 'YuJin', gender: 'Female', language: 'Korean (South Korea)', accent: 'ko-KR' },

  // Dutch (Netherlands)
  { id: 'nl-NL-FennaNeural', name: 'Fenna', gender: 'Female', language: 'Dutch (Netherlands)', accent: 'nl-NL' },
  { id: 'nl-NL-MaartenNeural', name: 'Maarten', gender: 'Male', language: 'Dutch (Netherlands)', accent: 'nl-NL' },
  { id: 'nl-NL-ColetteNeural', name: 'Colette', gender: 'Female', language: 'Dutch (Netherlands)', accent: 'nl-NL' },

  // Turkish, Polish, Vietnamese, Thai, Indonesian
  { id: 'tr-TR-EmelNeural', name: 'Emel', gender: 'Female', language: 'Turkish (Turkey)', accent: 'tr-TR' },
  { id: 'tr-TR-AhmetNeural', name: 'Ahmet', gender: 'Male', language: 'Turkish (Turkey)', accent: 'tr-TR' },
  { id: 'pl-PL-ZofiaNeural', name: 'Zofia', gender: 'Female', language: 'Polish (Poland)', accent: 'pl-PL' },
  { id: 'pl-PL-MarekNeural', name: 'Marek', gender: 'Male', language: 'Polish (Poland)', accent: 'pl-PL' },
  { id: 'vi-VN-HoaiMyNeural', name: 'HoaiMy', gender: 'Female', language: 'Vietnamese (Vietnam)', accent: 'vi-VN' },
  { id: 'vi-VN-NamMinhNeural', name: 'NamMinh', gender: 'Male', language: 'Vietnamese (Vietnam)', accent: 'vi-VN' },
  { id: 'th-TH-AcharaNeural', name: 'Achara', gender: 'Female', language: 'Thai (Thailand)', accent: 'th-TH' },
  { id: 'th-TH-NiwatNeural', name: 'Niwat', gender: 'Male', language: 'Thai (Thailand)', accent: 'th-TH' },
  { id: 'id-ID-GadisNeural', name: 'Gadis', gender: 'Female', language: 'Indonesian (Indonesia)', accent: 'id-ID' },
  { id: 'id-ID-ArdiNeural', name: 'Ardi', gender: 'Male', language: 'Indonesian (Indonesia)', accent: 'id-ID' },
];
