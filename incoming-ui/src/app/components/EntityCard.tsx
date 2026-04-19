interface EntityCardProps {
  name: string;
  subtitle?: string;
  image?: string;
  tags?: string[];
  metrics?: Array<{ label: string; value: string }>;
  description?: string;
}

export function EntityCard({ name, subtitle, image, tags, metrics, description }: EntityCardProps) {
  return (
    <div className="p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        {image && (
          <div className="w-12 h-12 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
            <img src={image} alt={name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="mb-0.5 truncate text-foreground">{name}</h4>
          {subtitle && <div className="text-sm text-muted-foreground truncate">{subtitle}</div>}
        </div>
      </div>

      {description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{description}</p>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-accent text-accent-foreground text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric, idx) => (
            <div key={idx} className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground mb-0.5">{metric.label}</div>
              <div className="text-sm text-foreground">{metric.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}