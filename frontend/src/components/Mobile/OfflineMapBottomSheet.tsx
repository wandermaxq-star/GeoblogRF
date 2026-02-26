import React, { useState } from 'react';
import { useBottomSheetStore, RegionDownload } from '../../stores/bottomSheetStore';
import { useBottomSheet } from '../../hooks/use-bottom-sheet';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Check } from 'lucide-react';

/**
 * Строка региона в списке офлайн-карт.
 */
const RegionRow: React.FC<{ region: RegionDownload }> = ({ region }) => {
  const select = useBottomSheetStore((s) => s.selectRegion);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={region.selected}
          onCheckedChange={(checked) => select(region.id, !!checked)}
        />
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{region.name}</span>
          <span className="text-xs text-muted-foreground">{region.area}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {region.status === 'downloading' && (
          <Progress value={region.progress ?? 0} className="w-24 h-1" />
        )}
        {region.status === 'done' && (
          <Check className="h-5 w-5 text-green-500" />
        )}
        {region.status === 'error' && (
          <span className="text-xs text-red-500">Ошибка</span>
        )}
        <span className="text-xs text-muted-foreground">{region.sizeMb} МБ</span>
      </div>
    </div>
  );
};

/**
 * OfflineMapBottomSheet — нижняя панель для управления офлайн-картами регионов.
 */
const OfflineMapBottomSheet: React.FC = () => {
  const { open, Sheet } = useBottomSheet();
  const regions = useBottomSheetStore((s) => s.regions);
  const [search, setSearch] = useState('');

  const filtered = regions.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedRegions = filtered.filter((r) => r.selected);
  const totalSize = selectedRegions.reduce((acc, r) => acc + r.sizeMb, 0);

  return (
    <>
      <Button onClick={open} variant="outline" className="fixed bottom-20 right-4 z-30">
        Офлайн карты
      </Button>
      <Sheet>
        <div className="flex flex-col h-full min-h-0">
          <h2 className="text-xl font-bold text-center mb-2 flex-shrink-0">
            Офлайн карты регионов
          </h2>

          {/* Поиск */}
          <div className="flex-shrink-0 px-2 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по регионам..."
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
            />
          </div>

          {/* Список регионов */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Ничего не найдено
              </div>
            ) : (
              filtered.map((region) => (
                <RegionRow key={region.id} region={region} />
              ))
            )}
          </div>

          {/* Футер */}
          <div className="flex-shrink-0 p-4 border-t border-border">
            <Button disabled={selectedRegions.length === 0} className="w-full">
              Скачать выбранное ({totalSize.toFixed(1)} МБ)
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
};

export default OfflineMapBottomSheet;
