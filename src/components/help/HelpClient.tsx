"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen, Search, ChevronRight, BarChart3,
  Filter, GitCompareArrows, Zap, BarChart2,
} from "lucide-react";
import type {
  HelpEntry, GlossaryEntry, FaqEntry, GuideEntry, HelpCategory,
} from "@/lib/help-catalog";

type Props = {
  metrics: HelpEntry[];
  glossary: GlossaryEntry[];
  faqs: FaqEntry[];
  guides: GuideEntry[];
};

type Tab = "metrics" | "guides" | "faqs" | "glossary";

const CATEGORY_LABEL: Record<HelpCategory, string> = {
  kpi: "📊 KPIs principales",
  chart: "📈 Gráficas y visualizaciones",
  filter: "🎯 Filtros",
  comparison: "⚖️ Comparativos",
  action: "⚡ Acciones",
};

const CATEGORY_ICON: Record<HelpCategory, React.ReactNode> = {
  kpi: <BarChart3 className="w-4 h-4 text-blue-500" />,
  chart: <BarChart2 className="w-4 h-4 text-emerald-500" />,
  filter: <Filter className="w-4 h-4 text-purple-500" />,
  comparison: <GitCompareArrows className="w-4 h-4 text-orange-500" />,
  action: <Zap className="w-4 h-4 text-amber-500" />,
};

export function HelpClient({ metrics, glossary, faqs, guides }: Props) {
  const [tab, setTab] = useState<Tab>("metrics");
  const [search, setSearch] = useState("");

  // Filtrar por búsqueda
  const filteredMetrics = metrics.filter((m) =>
    !search ||
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.summary.toLowerCase().includes(search.toLowerCase()) ||
    m.shortDescription.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGlossary = glossary.filter((g) =>
    !search ||
    g.term.toLowerCase().includes(search.toLowerCase()) ||
    g.definition.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFaqs = faqs.filter((f) =>
    !search ||
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGuides = guides.filter((g) =>
    !search ||
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.description.toLowerCase().includes(search.toLowerCase())
  );

  // Agrupar métricas por categoría
  const metricsByCategory = filteredMetrics.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<HelpCategory, HelpEntry[]>);

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar en la ayuda..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b">
        <TabButton active={tab === "metrics"} onClick={() => setTab("metrics")}>
          📊 Métricas y gráficas
          <Badge variant="secondary" className="ml-1.5 text-[10px]">{metrics.length}</Badge>
        </TabButton>
        <TabButton active={tab === "guides"} onClick={() => setTab("guides")}>
          📚 Guías paso a paso
          <Badge variant="secondary" className="ml-1.5 text-[10px]">{guides.length}</Badge>
        </TabButton>
        <TabButton active={tab === "faqs"} onClick={() => setTab("faqs")}>
          💡 FAQs
          <Badge variant="secondary" className="ml-1.5 text-[10px]">{faqs.length}</Badge>
        </TabButton>
        <TabButton active={tab === "glossary"} onClick={() => setTab("glossary")}>
          📖 Glosario
          <Badge variant="secondary" className="ml-1.5 text-[10px]">{glossary.length}</Badge>
        </TabButton>
      </div>

      {/* Contenido según tab */}
      {tab === "metrics" && (
        <div className="space-y-6">
          {Object.entries(metricsByCategory).length === 0 ? (
            <EmptyState text="Ninguna métrica coincide con tu búsqueda" />
          ) : (
            Object.entries(metricsByCategory).map(([cat, items]) => (
              <div key={cat}>
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  {CATEGORY_ICON[cat as HelpCategory]}
                  {CATEGORY_LABEL[cat as HelpCategory]}
                </h2>
                <div className="space-y-3">
                  {items.map((m) => (
                    <MetricCard key={m.slug} entry={m} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "guides" && (
        <div className="space-y-3">
          {filteredGuides.length === 0 ? (
            <EmptyState text="Ninguna guía coincide con tu búsqueda" />
          ) : (
            filteredGuides.map((g) => <GuideCard key={g.slug} guide={g} />)
          )}
        </div>
      )}

      {tab === "faqs" && (
        <div className="space-y-2">
          {filteredFaqs.length === 0 ? (
            <EmptyState text="Ninguna pregunta coincide con tu búsqueda" />
          ) : (
            filteredFaqs.map((f, i) => <FaqCard key={i} faq={f} />)
          )}
        </div>
      )}

      {tab === "glossary" && (
        <div className="space-y-2">
          {filteredGlossary.length === 0 ? (
            <EmptyState text="Ningún término coincide con tu búsqueda" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredGlossary.map((g, i) => (
                    <div key={i} className="p-4 hover:bg-muted/30">
                      <p className="font-semibold text-sm">{g.term}</p>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{g.definition}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}

function MetricCard({ entry }: { entry: HelpEntry }) {
  const [openTab, setOpenTab] = useState<"summary" | "purpose" | "technical" | null>(null);

  return (
    <Card id={entry.slug}>
      <CardContent className="p-4 space-y-3">
        {/* Título y descripción corta */}
        <div>
          <h3 className="font-semibold text-base">{entry.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.shortDescription}</p>
        </div>

        {/* Tabs internas */}
        <div className="flex gap-1 border-b">
          <InnerTab
            active={openTab === null || openTab === "summary"}
            onClick={() => setOpenTab("summary")}
          >
            Resumen
          </InnerTab>
          <InnerTab
            active={openTab === "purpose"}
            onClick={() => setOpenTab("purpose")}
          >
            Para qué sirve
          </InnerTab>
          <InnerTab
            active={openTab === "technical"}
            onClick={() => setOpenTab("technical")}
          >
            Técnico
          </InnerTab>
        </div>

        {/* Contenido del tab activo */}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {(openTab === null || openTab === "summary") && entry.summary}
          {openTab === "purpose" && entry.purpose}
          {openTab === "technical" && (
            <div className="font-mono text-xs bg-muted/50 p-3 rounded whitespace-pre-wrap">
              {entry.technical}
            </div>
          )}
        </div>

        {/* Troubleshoot opcional */}
        {entry.troubleshoot && (openTab === null || openTab === "summary") && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
              ⚠️ Si veo algo raro...
            </summary>
            <div className="mt-2 p-3 bg-amber-50 border-l-2 border-amber-300 rounded text-amber-900 whitespace-pre-wrap">
              {entry.troubleshoot}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function InnerTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function GuideCard({ guide }: { guide: GuideEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card id={guide.slug}>
      <CardContent className="p-4 space-y-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
              {guide.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{guide.description}</p>
          </div>
          <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        {expanded && (
          <div className="space-y-3 pt-3 border-t">
            <ol className="space-y-2.5">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 leading-relaxed pt-0.5" dangerouslySetInnerHTML={{ __html: renderMarkdown(step) }} />
                </li>
              ))}
            </ol>
            {guide.tip && (
              <div className="p-3 bg-blue-50 border-l-2 border-blue-300 rounded text-xs text-blue-900">
                <strong>💡 Tip:</strong> {guide.tip}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FaqCard({ faq }: { faq: FaqEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardContent className="p-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full p-4 flex items-start justify-between gap-3 text-left hover:bg-muted/30"
        >
          <p className="font-medium text-sm flex-1">{faq.question}</p>
          <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        {open && (
          <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed border-t pt-3"
               dangerouslySetInnerHTML={{ __html: renderMarkdown(faq.answer) }} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Markdown muy simple: solo **negrita**, *cursiva*, `code` y newlines.
 * Suficiente para el contenido que tenemos.
 */
function renderMarkdown(text: string): string {
  // Escape HTML
  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // **negrita**
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // `code`
  result = result.replace(/`([^`]+)`/g, "<code class=\"bg-muted px-1 py-0.5 rounded text-[11px]\">$1</code>");

  // Newlines
  result = result.replace(/\n/g, "<br/>");

  return result;
}
