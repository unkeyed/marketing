import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ(props: {
  epigraph?: string;
  title: string;
  description: string;
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <h3 className="not-prose blog-heading-gradient text-left font-medium tracking-tight text-3xl lg:text-4xl">
          {props.title}
        </h3>
        <p className="font-medium leading-8 not-prose text-white/70 lg:text-xl text-base max-w-3xl text-left">
          {props.description}
        </p>
      </div>
      <div className="mx-auto md:max-w-[1200px]">
        <Accordion type="single" collapsible className="w-full space-y-4">
          {props.items.map((item) => (
            <AccordionItem
              value={item.question}
              key={item.question}
              className="border border-white/10 rounded-lg bg-white/5 px-6 py-2 hover:bg-white/10 transition-colors"
            >
              <AccordionTrigger className="justify-between space-x-4 text-left py-6 hover:no-underline">
                <span className="text-white font-medium">{item.question}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-6 pt-2 text-white/80 leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
