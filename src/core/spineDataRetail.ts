/**
 * Древки современных серий — данные, не логика. Файл сгенерирован.
 *
 * Источник: карточки товаров Lancaster Archery Supply, https://lancasterarchery.com/
 * Пересборка: scripts/fetch-retail-db.py — руками не правим, правки затрутся.
 *
 * Зачем: база Стю собрана в 2012 году и современных таргетных серий не знает,
 * а сайт Easton из этой сети недоступен. Ритейлер печатает заводскую таблицу
 * на странице товара, оттуда и берём.
 *
 * Записаны только модели, у которых на странице есть все три числа: спайн, GPI
 * и наружный диаметр. Где диаметра нет — модель пропущена: подставить его
 * неоткуда, а в расчёт он входит напрямую.
 */

import type { ShaftSpec } from './spineData'

export const RETAIL_SHAFTS: ShaftSpec[] = [
  {"material": "carbon", "brand": "Victory", "series": "VForce 245 Gamer V3", "size": "300", "deflection": 0.3, "gpi": 9.9, "od": 0.309, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Victory", "series": "VForce 245 Gamer V3", "size": "350", "deflection": 0.35, "gpi": 8.7, "od": 0.298, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Victory", "series": "VForce 245 Gamer V3", "size": "400", "deflection": 0.4, "gpi": 8.2, "od": 0.295, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Victory", "series": "VForce 245 Gamer V3", "size": "500", "deflection": 0.5, "gpi": 6.9, "od": 0.287, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Victory", "series": "VForce 245 Gamer V3", "size": "600", "deflection": 0.6, "gpi": 6.7, "od": 0.287, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "hybrid", "brand": "Easton", "series": "FMJ 4mm Match Grade", "size": "250", "deflection": 0.25, "gpi": 12.3, "od": 0.247, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "hybrid", "brand": "Easton", "series": "FMJ 4mm Match Grade", "size": "300", "deflection": 0.3, "gpi": 11.7, "od": 0.244, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "hybrid", "brand": "Easton", "series": "FMJ 4mm Match Grade", "size": "340", "deflection": 0.34, "gpi": 11.0, "od": 0.24, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "hybrid", "brand": "Easton", "series": "FMJ 4mm Match Grade", "size": "400", "deflection": 0.4, "gpi": 9.8, "od": 0.234, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 5mm", "size": "200", "deflection": 0.2, "gpi": 12.0, "od": 0.286, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 5mm", "size": "260", "deflection": 0.26, "gpi": 11.5, "od": 0.28, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 5mm", "size": "300", "deflection": 0.3, "gpi": 10.7, "od": 0.275, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 5mm", "size": "340", "deflection": 0.34, "gpi": 9.5, "od": 0.267, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 5mm", "size": "400", "deflection": 0.4, "gpi": 9.0, "od": 0.264, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 5mm", "size": "500", "deflection": 0.5, "gpi": 8.1, "od": 0.258, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 5mm", "size": "600", "deflection": 0.6, "gpi": 7.2, "od": 0.253, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 4mm Long Range Match Grade Pro", "size": "250", "deflection": 0.25, "gpi": 9.8, "od": 0.244, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 4mm Long Range Match Grade Pro", "size": "300", "deflection": 0.3, "gpi": 9.3, "od": 0.241, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 4mm Long Range Match Grade Pro", "size": "340", "deflection": 0.34, "gpi": 8.3, "od": 0.234, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Axis 4mm Long Range Match Grade Pro", "size": "400", "deflection": 0.4, "gpi": 7.6, "od": 0.229, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Sonic 6.0 Match Grade", "size": "250", "deflection": 0.25, "gpi": 9.5, "od": 0.291, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Sonic 6.0 Match Grade", "size": "300", "deflection": 0.3, "gpi": 8.8, "od": 0.286, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Sonic 6.0 Match Grade", "size": "340", "deflection": 0.34, "gpi": 7.8, "od": 0.279, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Sonic 6.0 Match Grade", "size": "400", "deflection": 0.4, "gpi": 7.2, "od": 0.275, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Sonic 6.0 Match Grade", "size": "500", "deflection": 0.5, "gpi": 6.7, "od": 0.273, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "Sonic 6.0 Match Grade", "size": "600", "deflection": 0.6, "gpi": 5.8, "od": 0.268, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "6.5 Match Grade", "size": "250", "deflection": 0.25, "gpi": 10.0, "od": 0.301, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "6.5 Match Grade", "size": "300", "deflection": 0.3, "gpi": 9.5, "od": 0.3, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "6.5 Match Grade", "size": "340", "deflection": 0.34, "gpi": 9.3, "od": 0.298, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "6.5 Match Grade", "size": "400", "deflection": 0.4, "gpi": 8.4, "od": 0.294, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
  {"material": "carbon", "brand": "Easton", "series": "6.5 Match Grade", "size": "500", "deflection": 0.5, "gpi": 7.3, "od": 0.287, "focComp": 0, "stockLength": null, "insert": null, "insertGrains": null, "nock": null},
]
