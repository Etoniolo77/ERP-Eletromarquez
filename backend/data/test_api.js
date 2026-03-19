
import axios

async function test_api() {
    try {
        const res = await axios.get('http://localhost:8000/api/v1/frota/dashboard?periodo=month&sector=CCM');
        console.log("Stats:", res.data.stats);
        console.log("Matrix size:", res.data.matrix.length);
        console.log("Matrix sample:", res.data.matrix.slice(0, 5));

        const res2 = await axios.get('http://localhost:8000/api/v1/frota/evolucao-medio?periodo=month&compare=regional&sector=CCM');
        console.log("Evolucao sample:", res2.data.slice(0, 2));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

test_api();
