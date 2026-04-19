import { SectionCard } from '../SectionCard';
import { Check, X } from 'lucide-react';

export function ComparisonView() {
  const companies = [
    {
      name: 'Acme Corp',
      metrics: {
        stage: 'Series B',
        revenue: '$2.4M ARR',
        employees: '150',
        growth: '+42% YoY',
        funding: '$15M',
        location: 'SF, CA',
      },
      features: {
        'Enterprise Focus': true,
        'Product-Led Growth': true,
        'International': false,
        'Profitable': false,
        'Remote-First': true,
      },
    },
    {
      name: 'TechFlow Inc',
      metrics: {
        stage: 'Series A',
        revenue: '$1.8M ARR',
        employees: '85',
        growth: '+38% YoY',
        funding: '$8M',
        location: 'NYC, NY',
      },
      features: {
        'Enterprise Focus': true,
        'Product-Led Growth': false,
        'International': true,
        'Profitable': false,
        'Remote-First': false,
      },
    },
    {
      name: 'DataWorks',
      metrics: {
        stage: 'Seed',
        revenue: '$1.2M ARR',
        employees: '45',
        growth: '+65% YoY',
        funding: '$4M',
        location: 'Austin, TX',
      },
      features: {
        'Enterprise Focus': false,
        'Product-Led Growth': true,
        'International': false,
        'Profitable': true,
        'Remote-First': true,
      },
    },
  ];

  const metricKeys = Object.keys(companies[0].metrics);
  const featureKeys = Object.keys(companies[0].features);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-foreground">Company Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Side-by-side analysis of top prospects
        </p>
      </div>

      <SectionCard title="Key Metrics">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground w-1/4">Metric</th>
                {companies.map((company) => (
                  <th key={company.name} className="px-4 py-3 text-left text-foreground">
                    {company.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metricKeys.map((key) => (
                <tr key={key} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{key}</td>
                  {companies.map((company) => (
                    <td key={company.name} className="px-4 py-3 text-sm text-foreground">
                      {company.metrics[key as keyof typeof company.metrics]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Characteristics">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground w-1/4">Feature</th>
                {companies.map((company) => (
                  <th key={company.name} className="px-4 py-3 text-left text-foreground">
                    {company.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {featureKeys.map((key) => (
                <tr key={key} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{key}</td>
                  {companies.map((company) => (
                    <td key={company.name} className="px-4 py-3">
                      {company.features[key as keyof typeof company.features] ? (
                        <Check className="w-4 h-4 text-chart-2" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}