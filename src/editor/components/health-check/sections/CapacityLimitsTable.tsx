import { SectionCard } from '../SectionCard';
import { Gauge } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CapacityLimits } from '../types';

interface CapacityLimitsTableProps {
  data: CapacityLimits;
}

export function CapacityLimitsTable({ data }: CapacityLimitsTableProps) {
  const currentIndex = data.sizes.indexOf(data.currentSize);

  return (
    <SectionCard 
      title="Device Capacity Limits" 
      icon={<Gauge className="size-4" />}
      collapsible
    >
      <div className="overflow-auto rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-32">Metric</TableHead>
              {data.sizes.map((size, index) => (
                <TableHead 
                  key={size} 
                  className={cn(
                    "text-center",
                    index === currentIndex && "bg-primary/10 font-bold"
                  )}
                >
                  {size}
                  {index === currentIndex && " ←"}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">CPU</TableCell>
              {data.cpu.map((value, index) => (
                <TableCell 
                  key={index} 
                  className={cn(
                    "text-center",
                    index === currentIndex && "bg-primary/10"
                  )}
                >
                  {value}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">System Memory</TableCell>
              {data.systemMemory.map((value, index) => (
                <TableCell 
                  key={index} 
                  className={cn(
                    "text-center",
                    index === currentIndex && "bg-primary/10"
                  )}
                >
                  {value}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">JVM Memory</TableCell>
              {data.jvmMemory.map((value, index) => (
                <TableCell 
                  key={index} 
                  className={cn(
                    "text-center",
                    index === currentIndex && "bg-primary/10"
                  )}
                >
                  {value}
                </TableCell>
              ))}
            </TableRow>
            {data.protocols.map((protocol) => (
              <TableRow key={protocol.name}>
                <TableCell className="font-medium">{protocol.name}</TableCell>
                {protocol.limits.map((value, index) => (
                  <TableCell 
                    key={index} 
                    className={cn(
                      "text-center font-mono text-xs",
                      index === currentIndex && "bg-primary/10"
                    )}
                  >
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Format: Devices / Instances / Requests Per Second
      </p>
    </SectionCard>
  );
}
