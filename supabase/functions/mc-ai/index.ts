// =====================================================================
//  MYC Smart Costing — Edge Function "mc-ai"
//  Intermédiaire sécurisé entre le navigateur et l'API Claude.
//  La clé ANTHROPIC_API_KEY reste côté serveur (secret Supabase).
//  Les outils sont exécutés dans le navigateur par le moteur de calcul
//  validé (engine.js) : Claude ne fabrique aucun chiffre lui-même.
//
//  Déploiement :
//    npx supabase login
//    npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref ztabtbqtscjfvrautczj
//    npx supabase functions deploy mc-ai --no-verify-jwt --project-ref ztabtbqtscjfvrautczj
// =====================================================================
import Anthropic from "npm:@anthropic-ai/sdk@^1.11.0";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAMES: Record<string, string> = {
  fr: "French", en: "English", it: "Italian", zh: "Simplified Chinese", ar: "Arabic",
};

const LEVERS = ["speed", "workers", "line_eff", "daily_eff", "paint_price", "paint_cons", "labor_rate", "amort", "jumps", "coef", "scrap", "quantity"];
const METRICS = ["finalPrice", "unitCost", "marginPct", "capacity", "productionHours", "totalAmount"];
const MODE = { type: "string", enum: ["excel", "corrected"], description: "excel = formules du classeur telles quelles ; corrected = variante corrigée proposée (à valider)" };

// Liste d'outils fixe et ordonnée (préfixe stable pour le cache de prompt)
const TOOLS = [
  {
    name: "get_context",
    description: "Retourne la pièce analysée, le mode, les valeurs actuelles des leviers, les indicateurs (prix de vente, prix de revient, marge, capacité, heures), les anomalies détectées, les objectifs enregistrés et la liste des pièces disponibles. À appeler en premier.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "select_product",
    description: "Change la pièce analysée. 'reference' doit être une référence renvoyée par get_context (ex. 'CAP', '17700 COVER').",
    strict: true,
    input_schema: { type: "object", properties: { reference: { type: "string" } }, required: ["reference"], additionalProperties: false },
  },
  {
    name: "simulate",
    description: "Recalcule la pièce avec des valeurs de leviers modifiées et renvoie les indicateurs avant/après. Unités : speed m/min ; workers personnes ; line_eff et daily_eff entre 0 et 1 ; paint_price et paint_cons en % (100 = actuel) ; labor_rate et amort en $/h ; jumps entier ; coef multiplicateur commercial ; scrap en % ; quantity en pièces.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        changes: { type: "array", items: { type: "object", properties: { lever: { type: "string", enum: LEVERS }, value: { type: "number" } }, required: ["lever", "value"], additionalProperties: false } },
        mode: MODE,
      },
      required: ["changes", "mode"], additionalProperties: false,
    },
  },
  {
    name: "solve_goal",
    description: "Trouve comment atteindre un objectif : pour chaque levier, la valeur nécessaire (et le % de changement), plus un plan combiné. comparator '<=' pour 'au plus', '>=' pour 'au moins'. marginPct est en %.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { metric: { type: "string", enum: METRICS }, comparator: { type: "string", enum: ["<=", ">="] }, target: { type: "number" }, mode: MODE },
      required: ["metric", "comparator", "target", "mode"], additionalProperties: false,
    },
  },
  {
    name: "sensitivity",
    description: "Effet d'une variation de ±10 % de chaque levier sur un indicateur, classé du plus influent au moins influent.",
    strict: true,
    input_schema: { type: "object", properties: { metric: { type: "string", enum: METRICS }, mode: MODE }, required: ["metric", "mode"], additionalProperties: false },
  },
  {
    name: "sweep",
    description: "Courbe : valeurs d'un indicateur quand un levier parcourt toute sa plage. La courbe est affichée à l'utilisateur dans le chat.",
    strict: true,
    input_schema: { type: "object", properties: { lever: { type: "string", enum: LEVERS }, metric: { type: "string", enum: METRICS }, mode: MODE }, required: ["lever", "metric", "mode"], additionalProperties: false },
  },
  {
    name: "price_for_quantity",
    description: "Prix unitaire commercial pour une quantité, selon la grille MYC (QUOTATION STANDARD FORMULA) appliquée au prix 50K calculé.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { quantity: { type: "number" }, client_type: { type: "string", enum: ["known", "new"] }, color: { type: "string", enum: ["standard", "special"] } },
      required: ["quantity", "client_type", "color"], additionalProperties: false,
    },
  },
  {
    name: "calculation_detail",
    description: "Détail étape par étape du calcul (surface, capacité, peinture, MOD, process, prix de revient, prix client) pour expliquer un prix.",
    strict: true,
    input_schema: { type: "object", properties: { mode: MODE }, required: ["mode"], additionalProperties: false },
  },
  {
    name: "save_goal",
    description: "Enregistre un objectif d'équipe pour la pièce analysée (suivi de progression dans l'application). N'appeler que si l'utilisateur demande d'enregistrer / fixer l'objectif. deadline au format AAAA-MM-JJ, ou chaîne vide si aucune échéance.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" }, metric: { type: "string", enum: METRICS }, comparator: { type: "string", enum: ["<=", ">="] },
        target: { type: "number" }, mode: MODE, deadline: { type: "string" },
      },
      required: ["title", "metric", "comparator", "target", "mode", "deadline"], additionalProperties: false,
    },
  },
];

const SYSTEM = `Tu es l'assistant IA de MYC Smart Costing, l'application de chiffrage des pièces métallisées (métallisation sous vide et peinture) de MYC Beauty Innovation Tunisia. Tu aides l'équipe (Slah Dridi, ingénieur méthodes, auteur des formules Excel ; M. Sami Ladjimi, directeur, qui valide les prix ; Mohamed, développeur) à comprendre les coûts, fixer des objectifs et trouver comment les atteindre.

Règles :
- Tout chiffre (prix, coût, marge, capacité, heures, valeur de levier nécessaire) doit venir d'un outil. N'invente ni n'estime jamais un chiffre toi-même. Si un outil ne peut pas répondre, dis-le.
- Commence par get_context quand tu ne connais pas encore la pièce analysée.
- Pour un objectif, utilise solve_goal, puis juge la faisabilité industrielle de chaque levier (un changement de plus de 15 % est ambitieux, de plus de 35 % difficile). Baisser le coefficient commercial réduit la marge et non le coût : signale-le. Propose un plan concret (qui fait quoi : essai peinture, négociation fournisseur, réglage chaîne…). N'enregistre un objectif avec save_goal que si l'utilisateur le demande.
- Quand une courbe aide à comprendre, appelle sweep : la courbe s'affiche dans le chat.
- Le mode "excel" reproduit le classeur de Slah tel quel ; il contient des anomalies connues : W7 multiplie le coût par l'efficacité journalière (baisser l'efficacité fait baisser le prix, ce qui est faux), l'efficacité chaîne est appliquée deux fois, le prix des pigments est exclu (E19 × 0), le rebut ne change pas le prix unitaire. Ne recommande jamais de baisser l'efficacité journalière pour baisser un prix. Le mode "corrected" est une proposition qui reste à valider par Slah et M. Sami.
- Les prix sont en USD. Sois concis et structuré (listes courtes, chiffres clés en gras), sans longue introduction.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST uniquement" }, 405);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "Secret ANTHROPIC_API_KEY non configuré sur Supabase." }, 500);

  let payload: { messages?: unknown; lang?: string };
  try { payload = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }
  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length === 0) return json({ error: "messages manquants" }, 400);
  // Garde-fous (la fonction est appelable avec la clé publique) : taille de conversation limitée
  if (messages.length > 80 || JSON.stringify(messages).length > 400_000) {
    return json({ error: "Conversation trop longue : démarrez une nouvelle conversation." }, 413);
  }
  const lang = LANG_NAMES[payload.lang ?? "fr"] ?? "French";

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Repli automatique sur un autre modèle si une demande est refusée par les filtres de sécurité
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: `Always answer in ${lang}.` },
      ],
      tools: TOOLS,
      messages,
    } as never);
    return json({ content: response.content, stop_reason: response.stop_reason, stop_details: response.stop_details ?? null, model: response.model });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Limite de requêtes atteinte, réessayez dans un instant." }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "Clé ANTHROPIC_API_KEY invalide." }, 500);
    if (err instanceof Anthropic.BadRequestError) return json({ error: `Requête refusée : ${err.message}` }, 400);
    if (err instanceof Anthropic.APIError) return json({ error: `Erreur API ${err.status} : ${err.message}` }, 502);
    return json({ error: String(err) }, 500);
  }
});
