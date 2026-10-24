"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles, ArrowLeft, CalendarClock, Send } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Panel } from "@/components/ui/section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Field, Select } from "@/components/ui/forms"
import { ProgressSteps, DRAFT_PIPELINE, type StepState } from "@/components/ui/progress-steps"
import { useCreateDraft, useDraft, useStylePresets, useRawPosts, usePublishDraft } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const OUTPUT_FORMATS = ["Telegram", "LinkedIn Post", "LinkedIn Article", "Twitter", "Email", "PDF", "PPTX", "Image"]
const LANGS = ["en", "ru", "ja", "ko", "zh"]

function CreateDraftInner() {
  const params = useSearchParams()
  const router = useRouter()
  const presetPostIds = (params.get("posts") ?? "").split(",").filter(Boolean)
  const clusterId = params.get("cluster")
  const existingId = params.get("id")

  const styles = useStylePresets()
  const rawPosts = useRawPosts({ limit: "100" })
  const create = useCreateDraft()
  const publish = usePublishDraft()

  const [scheduleAt, setScheduleAt] = useState("")
  const [topic, setTopic] = useState("")
  const [styleId, setStyleId] = useState<string>("")
  const [language, setLanguage] = useState("en")
  const [outputs, setOutputs] = useState<Set<string>>(new Set(["Telegram"]))
  const [translations, setTranslations] = useState<Set<string>>(new Set())
  const [draftId, setDraftId] = useState<string | null>(existingId)

  const selectedPosts = (rawPosts.data ?? []).filter((p) => presetPostIds.includes(p.id))

  const draft = useDraft(draftId)
  // poll while in progress
  const status = draft.data?.pipeline_status?.toLowerCase()
  const inProgress = !!status && !["ready", "failed", "done"].includes(status)

  // prefill topic when opening an existing draft
  useEffect(() => {
    if (existingId && draft.data?.topic && !topic) setTopic(draft.data.topic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId, draft.data?.topic])

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const next = new Set(set)
    next.has(v) ? next.delete(v) : next.add(v)
    setter(next)
  }

  const onGenerate = () => {
    if (!topic.trim()) {
      toast.error("Topic required")
      return
    }
    create.mutate(
      {
        topic,
        source_post_ids: presetPostIds,
        cluster_id: clusterId,
        style_preset_id: styleId || null,
        language,
        output_formats: Array.from(outputs),
        translation_targets: Array.from(translations),
      },
      {
        onSuccess: (d) => {
          if (d?.id) {
            setDraftId(d.id)
            toast.success("Generation started")
          }
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      }
    )
  }

  const onPublish = (schedule: boolean) => {
    if (!draftId) return
    const platforms = Array.from(outputs)
      .map((f) => f.toLowerCase().split(" ")[0])
      .filter((p) => ["telegram", "linkedin", "twitter", "email"].includes(p))
    if (!platforms.length) {
      toast.error("Select at least one publishable format")
      return
    }
    const body: Record<string, unknown> = { platforms, languages: [language, ...Array.from(translations)] }
    if (schedule) {
      const when = scheduleAt ? new Date(scheduleAt) : null
      if (!when || when.getTime() <= Date.now()) {
        toast.error("Pick a future date and time to schedule")
        return
      }
      body.scheduled_at = when.toISOString()
    }
    publish.mutate(
      { id: draftId, body },
      {
        onSuccess: () => toast.success(schedule ? "Scheduled" : "Publishing"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      }
    )
  }

  const steps = DRAFT_PIPELINE.map((s, i) => {
    const order = DRAFT_PIPELINE.map((x) => x.key)
    const idx = status ? order.indexOf(status) : -1
    let state: StepState = "pending"
    if (status === "ready") state = "done"
    else if (status === "failed") state = "failed"
    else if (idx >= 0) state = i < idx ? "done" : i === idx ? "active" : "pending"
    return { ...s, state }
  })

  return (
    <div className="mx-auto min-h-screen w-full max-w-content px-page py-[22px] text-ink">
      <PageHeader
        title={existingId ? "Edit Draft" : "Create Draft"}
        subtitle="Synthesize content from selected sources"
        actions={
          <Button variant="secondary" onClick={() => router.push("/content/drafts")}>
            <ArrowLeft className="h-4 w-4" /> Back to Drafts
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* LEFT: sources */}
        <Panel title={`Source Posts (${selectedPosts.length})`} bodyClassName="space-y-2.5 py-4">
          {selectedPosts.length === 0 && (
            <p className="text-[13px] text-ink/55">
              {clusterId ? "Based on a topic cluster." : "No source posts selected. Add from Raw Posts."}
            </p>
          )}
          {selectedPosts.map((p) => (
            <div key={p.id} className="rounded-card border border-line bg-white p-3">
              <p className="line-clamp-2 text-[13px] leading-snug text-ink/75">{p.summary || p.raw_text?.slice(0, 120)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(p.tags ?? []).slice(0, 4).map((t) => (
                  <span key={t} className="rounded-chip bg-lavender px-2 py-0.5 text-[11px] font-semibold">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Panel>

        {/* RIGHT: settings + results */}
        <div className="flex min-w-0 flex-col gap-[16px]">
          <Panel title="Draft Settings" bodyClassName="space-y-4 py-4">
            <Field label="Topic">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic of the post" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Style Preset">
                <Select value={styleId} onChange={(e) => setStyleId(e.target.value)}>
                  <option value="">Default</option>
                  {(styles.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Language">
                <Select value={language} onChange={(e) => setLanguage(e.target.value)} className="uppercase">
                  {LANGS.map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Output Formats</span>
              <div className="flex flex-wrap gap-1.5">
                {OUTPUT_FORMATS.map((f) => (
                  <button
                    key={f}
                    onClick={() => toggle(outputs, setOutputs, f)}
                    className={cn(
                      "rounded-chip border px-2.5 py-1 text-[12px] font-semibold transition-colors",
                      outputs.has(f) ? "border-lavender-text bg-lavender text-ink" : "border-line text-ink/60 hover:bg-line-soft"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70">Translation Targets</span>
              <div className="flex flex-wrap gap-1.5">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => toggle(translations, setTranslations, l)}
                    className={cn(
                      "rounded-chip border px-2.5 py-1 text-[12px] font-semibold uppercase transition-colors",
                      translations.has(l) ? "border-lavender-text bg-lavender text-ink" : "border-line text-ink/60 hover:bg-line-soft"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={onGenerate} disabled={create.isPending || inProgress}>
              <Sparkles className="h-4 w-4" /> {inProgress ? "Generating…" : "Generate"}
            </Button>
          </Panel>

          {draftId && (
            <Panel
              title="Generation"
              action={
                <Badge tone={status === "ready" ? "success" : status === "failed" ? "danger" : "info"}>
                  {status ?? "pending"}
                </Badge>
              }
              bodyClassName="space-y-4 py-4"
            >
              <ProgressSteps steps={steps} />
              {draft.data?.styled_text && (
                <div className="whitespace-pre-wrap rounded-card border border-line bg-canvas p-3 text-[13px] leading-normal text-ink/80">
                  {draft.data.styled_text}
                </div>
              )}
              {status === "ready" && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => onPublish(false)} disabled={publish.isPending}>
                    <Send className="h-4 w-4" /> Publish Now
                  </Button>
                  <input
                    type="datetime-local"
                    aria-label="Schedule time"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="h-9 rounded-card border border-line bg-white px-2 text-[13px]"
                  />
                  <Button variant="secondary" onClick={() => onPublish(true)} disabled={publish.isPending}>
                    <CalendarClock className="h-4 w-4" /> Schedule
                  </Button>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CreateDraftPage() {
  return (
    <Suspense fallback={null}>
      <CreateDraftInner />
    </Suspense>
  )
}
