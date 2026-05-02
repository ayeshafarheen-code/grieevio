import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req: Request) => {
  try {
    const { complaint_id } = await req.json()
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Fetch complaint
    const { data: c, error: fetchErr } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaint_id)
      .single()

    if (fetchErr || !c) throw new Error("Complaint not found")

    // 2. Process with Groq
    const prompt = `Classify this civic complaint: "${c.description}". 
    Respond ONLY with JSON: {"category": "Roads|Water|Garbage|Electricity|Other", "confidence": 0-100, "priority": "Low|Medium|High|Critical"}`

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    })

    const aiResult = await response.json()
    const parsed = JSON.parse(aiResult.choices[0].message.content)

    // 3. Update complaint
    await supabase.from('complaints').update({
      category: parsed.category,
      priority: c.is_urgent ? 'Critical' : parsed.priority,
      verification_score: parsed.confidence
    }).eq('id', complaint_id)

    return new Response(JSON.stringify({ success: true, ai: parsed }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
