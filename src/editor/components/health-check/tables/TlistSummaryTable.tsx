import { SectionCard } from '../SectionCard';
import { Activity, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TlistSummaryItem, SuggestedCollectors } from '../types';

interface TlistSummaryTableProps {
  data: TlistSummaryItem[];
  totalInstances: number;
  suggestedCollectors: SuggestedCollectors;
}

export function TlistSummaryTable({ data, totalInstances, suggestedCollectors }: TlistSummaryTableProps) {
  if (!data || data.length === 0) {
    return (
      <SectionCard title="Collection Summary" icon={<Activity className="size-4" />}>
        <div className="
          flex items-center justify-center py-8 text-muted-foreground
          select-none
        ">
          <Info className="mr-2 size-5 opacity-50" />
          <span className="text-sm">No collection summary available</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Collection Summary" 
      icon={<Activity className="size-4" />}
      collapsible
      headerAction={
        <Badge variant="secondary" className="font-mono select-none">
          {totalInstances.toLocaleString()} instances
        </Badge>
      }
    >
      <div className="space-y-4">
        <div className="max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Collector</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Interval</TableHead>
                <TableHead className="text-right">RPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.type}</TableCell>
                  <TableCell className="font-mono text-sm">{item.collector}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.interval}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.rps.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {suggestedCollectors && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-sm font-medium select-none">Suggested Collector Count for {totalInstances.toLocaleString()} Instances:</p>
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="select-none">M: {suggestedCollectors.M}</Badge>
              <Badge variant="outline" className="select-none">L: {suggestedCollectors.L}</Badge>
              <Badge variant="outline" className="select-none">XL: {suggestedCollectors.XL}</Badge>
              <Badge variant="outline" className="select-none">XXL: {suggestedCollectors.XXL}</Badge>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

