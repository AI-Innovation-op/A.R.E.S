import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { createAresModel } from '../src/avatar/model';
import { conversationPose, getPose, poses } from '../src/domain/poses';

describe('avatar articulado', () => {
  it('construye las 16 poses con geometría finita y expresiones distintas', () => {
    const model = createAresModel();
    const signatures = new Set<string>();
    for (const pose of poses) {
      model.setPose(pose); model.update(1.25, 1, true, false); model.root.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model.root);
      expect([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)).toBe(true);
      const values: string[] = [];
      model.root.traverse(object => { values.push(`${object.visible}:${object.position.toArray().join(',')}:${object.rotation.toArray().join(',')}`); });
      signatures.add(values.join('|'));
    }
    expect(signatures.size).toBe(16);
    model.dispose();
  });
  it('congela desplazamiento y articulaciones cuando se reduce el movimiento', () => {
    const model = createAresModel(); model.setPose(getPose(6));
    const state = () => { const entries: number[] = []; model.root.traverse(object => { entries.push(...object.position.toArray(), object.rotation.x, object.rotation.y, object.rotation.z); }); return entries; };
    model.update(5, .016, false, true); const first = state();
    model.update(9, .016, false, true); expect(state()).toEqual(first);
    model.dispose();
  });
  it('libera geometrías al desmontar el avatar', () => {
    const model = createAresModel(); model.setPose(getPose(1));
    let disposed = 0;
    model.root.traverse(object => {
      if ('geometry' in object && typeof object.geometry === 'object' && object.geometry !== null && 'addEventListener' in object.geometry) {
        const geometry = object.geometry as import('three').BufferGeometry;
        geometry.addEventListener('dispose', () => { disposed++; });
      }
    });
    model.dispose(); expect(disposed).toBeGreaterThan(0);
  });
});

describe('expresión según conversación', () => {
  it.each([
    ['Estoy agotado y quiero refactorizar', false, 14],
    ['Excelente, funcionó', true, 4],
    ['Audita una inyección SQL', false, 13],
    ['Genera un README', false, 15],
    ['Optimiza esta consulta SQL lenta', false, 8],
    ['Refactoriza esta clase', false, 10],
    ['Refactoriza esta clase', true, 11],
    ['Hay un error en el código', false, 9],
    ['Hay un error en el código', true, 12],
    ['Explica este conflicto', false, 3],
    ['Diseña la arquitectura', false, 7],
    ['Investiga esta librería', false, 6],
    ['Hola', true, 1],
  ])('elige la pose contextual para %s', (text, completed, expected) => {
    expect(conversationPose(text, completed).id).toBe(expected);
  });
});
