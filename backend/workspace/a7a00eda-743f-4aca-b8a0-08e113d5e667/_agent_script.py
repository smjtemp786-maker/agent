def fibonacci(n):
    fibs = []
    a, b = 0, 1
    for _ in range(n):
        fibs.append(a)
        a, b = b, a + b
    return fibs

result = fibonacci(12)
print('First 12 Fibonacci numbers:')
print(result)