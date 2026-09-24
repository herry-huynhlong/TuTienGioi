export function seededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
export function seedFromString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
export function pickWeighted(rows, rng) {
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    let roll = rng() * total;
    for (const row of rows) {
        roll -= row.weight;
        if (roll <= 0)
            return row;
    }
    return rows[rows.length - 1];
}
