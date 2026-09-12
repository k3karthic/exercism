import com.github.k3karthic.grpc.runDemo
import kotlinx.coroutines.test.runTest
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals

internal class MainTest {
    @Test
    fun testDemo() =
        runTest {
            val num = Random.nextInt(0, 100)
            val result = runDemo(50051, num)

            assertEquals(num * 2, result.result)
        }
}
