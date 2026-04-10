import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import type { CuratedRoutePack } from '../../types/proRoutePacks';

const CuratedRoutePacksPanel: React.FC = () => {
  const [packs, setPacks] = useState<CuratedRoutePack[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<CuratedRoutePack | null>(null);
  const [jsonValue, setJsonValue] = useState('');
  const [formPack, setFormPack] = useState<Partial<CuratedRoutePack>>({});
  const [useRawJson, setUseRawJson] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<CuratedRoutePack[]>('/curated-route-packs');
      setPacks(res.data);
    } catch (e) {
      console.error(e);
      alert('Не удалось загрузить пакеты');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openModal = (pack?: CuratedRoutePack) => {
    setEditingPack(pack || null);
    const initial = pack ? { ...pack } : {};
    setFormPack(initial);
    setJsonValue(pack ? JSON.stringify(pack, null, 2) : '{}');
    setUseRawJson(false);
    setModalOpen(true);
  };

  const save = async () => {
    try {
      let obj: any;
      if (useRawJson) {
        obj = JSON.parse(jsonValue);
      } else {
        // convert comma-separated strings back to arrays
        obj = {
          ...editingPack,
          ...formPack,
          regions: (formPack.regions as unknown as string || '').split(',').map(s => s.trim()).filter(Boolean),
          tags: (formPack.tags as unknown as string || '').split(',').map(s => s.trim()).filter(Boolean),
        };
      }
      if (editingPack) {
        await api.put(`/curated-route-packs/${editingPack.id}`, obj);
        alert('Пакет обновлён');
      } else {
        await api.post('/curated-route-packs', obj);
        alert('Пакет создан');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      console.error(e);
      alert('Неверный JSON или ошибка сервера');
    }
  };

  const remove = async (pack: CuratedRoutePack) => {
    if (!window.confirm(`Удалить пакет ${pack.id}?`)) return;
    try {
      await api.delete(`/curated-route-packs/${pack.id}`);
      alert('Пакет удалён');
      load();
    } catch (e) {
      console.error(e);
      alert('Ошибка удаления');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Кураторские пакеты</h2>
      <button
        onClick={() => openModal()}
        className="mb-4 px-3 py-1 bg-green-600 text-white rounded"
      >
        Новый пакет
      </button>

      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-1">ID</th>
              <th className="text-left py-1">Название</th>
              <th className="text-left py-1">Действия</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.id} className="odd:bg-gray-50">
                <td className="py-1">{p.id}</td>
                <td className="py-1">{p.title}</td>
                <td className="py-1 space-x-2">
                  <button
                    onClick={() => openModal(p)}
                    className="text-blue-600 hover:underline"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-3/4 max-w-xl p-4">
            <h3 className="text-lg font-semibold mb-2">
              {editingPack ? 'Редактировать пакет' : 'Новый пакет'}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Slug:
                  <input
                    type="text"
                    className="border p-1 flex-1 ml-2"
                    value={formPack.slug || ''}
                    onChange={(e) => setFormPack({ ...formPack, slug: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Название:
                  <input
                    type="text"
                    className="border p-1 flex-1 ml-2"
                    value={formPack.title || ''}
                    onChange={(e) => setFormPack({ ...formPack, title: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Краткий:
                  <input
                    type="text"
                    className="border p-1 flex-1 ml-2"
                    value={formPack.subtitle || ''}
                    onChange={(e) => setFormPack({ ...formPack, subtitle: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-start">
                  Summary:
                  <textarea
                    className="border p-1 flex-1 ml-2"
                    rows={3}
                    value={formPack.summary || ''}
                    onChange={(e) => setFormPack({ ...formPack, summary: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Route kind:
                  <select
                    className="border p-1 ml-2"
                    value={formPack.routeKind || ''}
                    onChange={(e) => setFormPack({ ...formPack, routeKind: e.target.value as any })}
                  >
                    <option value="">(select)</option>
                    <option value="federal">federal</option>
                    <option value="regional">regional</option>
                    <option value="event">event</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Regions:
                  <input
                    type="text"
                    className="border p-1 flex-1 ml-2"
                    value={(formPack.regions as unknown as string) || ''}
                    placeholder="comma-separated"
                    onChange={(e) => setFormPack({ ...formPack, regions: e.target.value as any })}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Tags:
                  <input
                    type="text"
                    className="border p-1 flex-1 ml-2"
                    value={(formPack.tags as unknown as string) || ''}
                    placeholder="comma-separated"
                    onChange={(e) => setFormPack({ ...formPack, tags: e.target.value as any })}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Highlight:
                  <input
                    type="text"
                    className="border p-1 flex-1 ml-2"
                    value={formPack.highlight || ''}
                    onChange={(e) => setFormPack({ ...formPack, highlight: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <label className="w-24 flex items-center">
                  Hero metric:
                  <input
                    type="text"
                    className="border p-1 flex-1 ml-2"
                    value={formPack.heroMetric || ''}
                    onChange={(e) => setFormPack({ ...formPack, heroMetric: e.target.value })}
                  />
                </label>
              </div>
            </div>
            <div className="mt-2">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={useRawJson}
                  onChange={() => setUseRawJson(!useRawJson)}
                  className="mr-1"
                />
                Редактировать JSON
              </label>
            </div>
            {useRawJson && (
              <textarea
                className="w-full h-64 border border-gray-300 p-2 font-mono text-xs mt-2"
                value={jsonValue}
                onChange={(e) => setJsonValue(e.target.value)}
              />
            )}
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Отмена
              </button>
              <button
                onClick={save}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                {editingPack ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuratedRoutePacksPanel;
