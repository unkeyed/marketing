import type { Glossary } from "@/.content-collections/generated";
import { Frame } from "@/components/frame";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  Code,
  Coffee,
  ExternalLink,
  FileText,
  RefreshCcw,
  Zap,
} from "lucide-react";
import { z } from "zod";

const itemSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const takeawaysSchema = z.object({
  tldr: z.string(),
  definitionAndStructure: z.array(itemSchema),
  historicalContext: z.array(itemSchema),
  usageInAPIs: z.object({
    tags: z.array(z.string()),
    description: z.string(),
  }),
  bestPractices: z.array(z.string()),
  recommendedReading: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
    }),
  ),
  didYouKnow: z.string(),
});

export default function Takeaways(props: Pick<Glossary, "term" | "takeaways">) {
  return (
    <Card className="w-full bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.1)] rounded-xl overflow-hidden relative border-white/20">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
      <CardHeader className="border-white/20 pb-8">
        <CardTitle className="text-2xl font-bold text-white">
          {props.term}: Key Takeaways
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-10 p-8">
        {/* Enhanced TL;DR Section */}
        <div className="mb-8">
          <Frame size="md">
            <div className="bg-gradient-to-br from-[rgb(22,22,22)] to-[rgb(8,8,8)] p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                  <Zap className="h-5 w-5 text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">TL;DR</h3>
              </div>
              <p className="text-base leading-relaxed text-white/90 font-medium">
                {props.takeaways.tldr}
              </p>
            </div>
          </Frame>
        </div>

        {/* Grid Sections with Better Spacing */}
        <div className="grid gap-8 lg:gap-10 md:grid-cols-2">
          <Section
            icon={<FileText className="h-5 w-5" />}
            title="Definition & Structure"
            content={
              <div className="space-y-4">
                {props.takeaways.definitionAndStructure.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <span className="font-medium text-white/80 text-sm block">
                      {item.key}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {item.value.split(",").map((value, index) => {
                        const trimmedValue = value.trim();
                        return (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-white/10 text-white/90 px-3 py-1 text-xs font-mono border border-white/20 max-w-[140px]"
                            title={trimmedValue}
                          >
                            <span className="truncate block min-w-0">
                              {trimmedValue}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            }
          />
          <Section
            icon={<Clock className="h-5 w-5" />}
            title="Historical Context"
            items={props.takeaways.historicalContext}
          />
          <Section
            icon={<Code className="h-5 w-5" />}
            title="Usage in APIs"
            content={
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {props.takeaways.usageInAPIs.tags.map((tag) => {
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-white/10 text-white/90 px-3 py-1 text-xs border border-white/20 max-w-[140px]"
                        title={tag}
                      >
                        <span className="truncate block min-w-0">{tag}</span>
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-sm text-white/70 leading-relaxed">
                  {props.takeaways.usageInAPIs.description}
                </p>
              </div>
            }
          />
          <Section
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Best Practices"
            items={props.takeaways.bestPractices}
          />
        </div>

        {/* Recommended Reading Section */}
        <div className="mt-8">
          <Section
            icon={<BookOpen className="h-5 w-5" />}
            title="Recommended Reading"
            content={
              <ul className="space-y-3 text-sm">
                {props.takeaways.recommendedReading.map((item) => (
                  <li key={item.title}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            }
          />
        </div>
      </CardContent>
      <CardFooter className="border-t border-white/10 pt-6">
        <div className="grid grid-cols-[auto_1fr_auto] gap-6 items-center w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Coffee className="h-4 w-4 text-purple-400" />
            </div>
            <span className="font-semibold text-white">Did You Know?</span>
          </div>
          <span className="text-white/70 text-sm leading-relaxed">
            {props.takeaways.didYouKnow}
          </span>
          <RefreshCcw className="h-4 w-4 text-white/60 cursor-pointer hover:text-white/80 transition-colors" />
        </div>
      </CardFooter>
    </Card>
  );
}

type SectionProps = {
  icon: React.ReactNode;
  title: string;
} & (
  | { items: Array<string | z.infer<typeof itemSchema>>; content?: never }
  | { items?: never; content: React.ReactNode }
);

function Section(props: SectionProps) {
  const { icon, title } = props;
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-3 text-white">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
          {icon}
        </div>
        <span>{title}</span>
      </h3>
      {props.content ? (
        <div className="ml-11">{props.content}</div>
      ) : (
        <div className="ml-11 space-y-3">
          {props.items?.map((item) =>
            typeof item === "string" ? (
              <div key={item} className="text-sm text-white/70 leading-relaxed">
                • {item}
              </div>
            ) : (
              <div key={item.key} className="space-y-2">
                <span className="font-medium text-white/80 text-sm block">
                  {item.key}
                </span>
                {item.value.includes(",") ? (
                  <div className="flex flex-wrap gap-2">
                    {item.value.split(",").map((value, index) => {
                      const trimmedValue = value.trim();
                      return (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-white/10 text-white/90 px-3 py-1 text-xs border border-white/20 max-w-[140px]"
                          title={trimmedValue}
                        >
                          <span className="truncate block min-w-0">
                            {trimmedValue}
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-white/10 text-white/90 px-3 py-1 text-xs border border-white/20 w-fit max-w-[140px]"
                    title={item.value}
                  >
                    <span className="truncate block min-w-0">{item.value}</span>
                  </Badge>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
