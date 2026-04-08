import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DATASETS } from "@/types/index";
import { Database, Layers } from "lucide-react";

export default function DatasetsPage() {
  const datasets = Object.values(DATASETS);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Datasets</h1>
        <p className="mt-1 text-sm text-slate-500">
          Medical imaging datasets used for training and evaluation
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {datasets.map((d) => (
          <Card key={d.name}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{d.displayName}</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">
                    {d.name}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">{d.description}</p>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {d.classes.length} classes
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(d.classes as readonly string[]).map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500 leading-relaxed">
            Upload dataset images to{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">
              public/datasets/&lt;dataset-name&gt;/
            </code>{" "}
            to enable local image browsing. ONNX models are served from{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">
              public/models/onnx/
            </code>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
