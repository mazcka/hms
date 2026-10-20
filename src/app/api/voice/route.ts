import { draftFromModel, emptyDraft } from "@/lib/voice-draft";

export const runtime = "nodejs";

const MISSING =
  "מפתח הבינה המלאכותית לא הוגדר. אפשר להשלים את כרטיס הטיוטה ידנית.";

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return Response.json(emptyDraft({ aiConfigured: false, aiMessage: MISSING }));
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json(emptyDraft({ aiConfigured: true, aiMessage: "לא התקבלה הקלטה." }), { status: 400 });
  }

  const whisperBody = new FormData();
  whisperBody.append("file", audio, audio.name || "clip.webm");
  whisperBody.append("model", "whisper-1");
  whisperBody.append("language", "he");

  const transcribed = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: whisperBody,
  });
  if (!transcribed.ok) {
    const detail = await transcribed.text();
    return Response.json(emptyDraft({ aiConfigured: true, aiMessage: `התמלול נכשל. ${detail.slice(0, 180)}` }));
  }
  const transcriptJson = (await transcribed.json()) as { text?: string };
  const transcript = transcriptJson.text?.trim() ?? "";

  const parsed = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Parse a Hebrew household note into JSON. Kinds: task (home chore, not shopping), shop (listName + items), class (weekly), event (dated; birthday needs a date), wish. If the utterance fits more than one kind or you are unsure, set confident to false and include every plausible option. Never pick one silently. Dates YYYY-MM-DD, times HH:MM, weekday 0-6 Sunday-Saturday. relation is daughter|classmate|other. eventKind is birthday|appointment|other. items are {name,quantity,unit,one_off}. Fields: taskTitle, taskDetails, taskDue, taskTime, taskWeekday, listName, items, personName, relation, className, weekday, startsAt, endsAt, place, eventTitle, eventKind, eventDate, eventTime, eventNotes, eventPerson, wishTitle, forLabel, url, wishNotes, priority. Return {confident, options:[{kind,...fields}]}.",
        },
        { role: "user", content: transcript || "(empty)" },
      ],
    }),
  });

  if (!parsed.ok) {
    const detail = await parsed.text();
    const draft = draftFromModel(transcript, `הניתוח נכשל. ${detail.slice(0, 180)}`, null);
    return Response.json(draft);
  }
  const completion = (await parsed.json()) as { choices?: { message?: { content?: string } }[] };
  const content = completion.choices?.[0]?.message?.content ?? "{}";
  let raw: unknown = null;
  try {
    raw = JSON.parse(content);
  } catch {
    raw = null;
  }
  return Response.json(draftFromModel(transcript, "", raw));
}
