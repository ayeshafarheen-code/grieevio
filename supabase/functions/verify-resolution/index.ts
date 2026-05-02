import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req: Request) => {
  try {
    const { complaint_id, after_image } = await req.json()
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    const { data: c } = await supabase.from('complaints').select('*').eq('id', complaint_id).single()
    if (!c) throw new Error("Complaint not found")

    // Get Before Image URL
    const { data: beforeUrl } = supabase.storage.from('complaints').getPublicUrl(c.image_path)

    // Compare with Groq Vision
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Compare these two images: the BEFORE image (URL) and the AFTER image (Base64). Determine if the civic issue is resolved. Respond ONLY with JSON: {\"resolved\": true/false, \"score\": 0-100}" },
            { type: "image_url", image_url: { url: beforeUrl.publicUrl } },
            { type: "image_url", image_url: { url: after_image } }
          ]
        }]
      })
    })

    const aiResult = await response.json()
    const parsed = JSON.parse(aiResult.choices[0].message.content)

    if (parsed.resolved) {
      await supabase.from('complaints').update({
        status: 'Resolved',
        verification_score: parsed.score
      }).eq('id', complaint_id)
    }

    return new Response(JSON.stringify(parsed), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
