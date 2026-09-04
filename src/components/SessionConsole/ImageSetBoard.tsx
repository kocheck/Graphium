import { toMediaProtocol } from '../../utils/mediaProtocol';

import type { StageImage } from '../../types/sessionConsole';

interface ImageSetBoardProps {
  title: string;
  images: StageImage[];
  activeImageId: string | null;
  onShowPlate: (imageId: string) => void;
  onEdit: (image: StageImage) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function ImageSetBoard({
  title,
  images,
  activeImageId,
  onShowPlate,
  onEdit,
  onReorder,
}: ImageSetBoardProps): JSX.Element {
  const handleDropOn = (targetId: string, draggedId: string): void => {
    if (draggedId === targetId) {
      return;
    }
    const ids = images.map((image) => image.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    onReorder(ids);
  };

  return (
    <div className="space-y-2">
      <h4
        className="text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        {title}
      </h4>
      <ul className="grid grid-cols-2 gap-2">
        {images.map((image) => {
          const isActive = image.id === activeImageId;
          return (
            <li key={image.id} className="space-y-1">
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', image.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropOn(image.id, event.dataTransfer.getData('text/plain'));
                }}
                onClick={() => onShowPlate(image.id)}
                aria-label={`Show plate ${image.name}`}
                aria-pressed={isActive}
                className={`w-full rounded p-1 text-left transition ${
                  isActive
                    ? 'bg-[var(--app-accent-bg)] border border-[var(--app-accent-border)]'
                    : 'bg-[var(--app-bg-subtle)]'
                }`}
              >
                <img
                  src={toMediaProtocol(image.thumbnailSrc)}
                  alt={image.alt}
                  loading="lazy"
                  className="w-full h-16 object-cover rounded mb-1"
                />
                <span className="block text-xs font-medium truncate" title={image.name}>
                  {image.name}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full py-0.5 text-[11px]"
                aria-label={`Edit plate ${image.name}`}
                onClick={() => onEdit(image)}
              >
                Edit
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
