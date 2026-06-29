import { AlgorithmProblem } from '@/types';

// Problem Bank - curated algorithm problems for practice
export const PROBLEM_BANK: AlgorithmProblem[] = [
  {
    id: 'two-sum',
    title: '两数之和',
    topicId: 'hash',
    difficulty: 1,
    description:
      '给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值的那两个整数，并返回它们的数组下标。你可以假设每种输入只会对应一个答案。',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: '因为 nums[0] + nums[1] == 9' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', '只会存在一个有效答案'],
    starterCode: `def two_sum(nums, target):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[2,7,11,15], 9', expectedOutput: '[0, 1]' },
      { input: '[3,2,4], 6', expectedOutput: '[1, 2]' },
      { input: '[3,3], 6', expectedOutput: '[0, 1]' },
      { input: '[1,5,8,12,13], 14', expectedOutput: '[1, 2]', isHidden: true },
    ],
    hints: [
      '想想能不能用哈希表记录已经遍历过的数字？',
      '对于每个数 nums[i]，我们需要找 target - nums[i] 是否在之前出现过',
      '用 dict 存储 {值: 索引}，一次遍历即可',
    ],
    solution: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    tags: ['哈希表', '数组'],
  },
  {
    id: 'binary-search-basic',
    title: '二分查找',
    topicId: 'binary-search',
    difficulty: 2,
    description:
      '给定一个 n 个元素有序的（升序）整型数组 nums 和一个目标值 target，写一个函数搜索 nums 中的 target，如果目标值存在返回下标，否则返回 -1。',
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1' },
    ],
    constraints: ['nums 中的所有元素互不相同', '1 <= nums.length <= 10^4'],
    starterCode: `def search(nums, target):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[-1,0,3,5,9,12], 9', expectedOutput: '4' },
      { input: '[-1,0,3,5,9,12], 2', expectedOutput: '-1' },
      { input: '[5], 5', expectedOutput: '0' },
      { input: '[1,2,3,4,5,6,7,8,9,10], 1', expectedOutput: '0', isHidden: true },
      { input: '[1,2,3,4,5,6,7,8,9,10], 10', expectedOutput: '9', isHidden: true },
    ],
    hints: [
      '定义左右指针 left 和 right，每次取中间值比较',
      '注意循环条件是 left <= right 还是 left < right？',
      'mid = left + (right - left) // 2 可以避免整数溢出',
    ],
    solution: `def search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,
    timeComplexity: 'O(log n)',
    spaceComplexity: 'O(1)',
    tags: ['二分查找', '数组'],
  },
  {
    id: 'reverse-linked-list',
    title: '反转链表',
    topicId: 'linked-list',
    difficulty: 3,
    description:
      '给你单链表的头节点 head，请你反转链表，并返回反转后的链表。',
    examples: [
      { input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' },
      { input: 'head = [1,2]', output: '[2,1]' },
      { input: 'head = []', output: '[]' },
    ],
    starterCode: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[1,2,3,4,5]', expectedOutput: '[5,4,3,2,1]' },
      { input: '[1,2]', expectedOutput: '[2,1]' },
      { input: '[]', expectedOutput: '[]' },
      { input: '[1]', expectedOutput: '[1]', isHidden: true },
    ],
    hints: [
      '用迭代法：维护 prev, curr 两个指针',
      '每次把 curr.next 指向 prev，然后三个指针都前进一步',
      '别忘了保存原来的 next 再修改！',
    ],
    solution: `def reverse_list(head):
    prev = None
    curr = head
    while curr:
        next_temp = curr.next
        curr.next = prev
        prev = curr
        curr = next_temp
    return prev`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['链表', '指针操作'],
  },
  {
    id: 'max-subarray',
    title: '最大子数组和',
    topicId: 'dp',
    difficulty: 4,
    description:
      '给你一个整数数组 nums，请你找出一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和。',
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: '连续子数组 [4,-1,2,1] 的和最大，为 6' },
      { input: 'nums = [1]', output: '1' },
      { input: 'nums = [5,4,-1,7,8]', output: '23' },
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    starterCode: `def max_sub_array(nums):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6' },
      { input: '[1]', expectedOutput: '1' },
      { input: '[5,4,-1,7,8]', expectedOutput: '23' },
      { input: '[-1]', expectedOutput: '-1', isHidden: true },
      { input: '[-2,-1]', expectedOutput: '-1', isHidden: true },
    ],
    hints: [
      '定义 dp[i] 为以 nums[i] 结尾的最大子数组和',
      'dp[i] = max(dp[i-1] + nums[i], nums[i])',
      '可以只用一个变量优化空间到 O(1)',
    ],
    solution: `def max_sub_array(nums):
    max_sum = nums[0]
    current_sum = nums[0]
    for i in range(1, len(nums)):
        current_sum = max(current_sum + nums[i], nums[i])
        max_sum = max(max_sum, current_sum)
    return max_sum`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['动态规划', 'Kadane算法'],
  },
  {
    id: 'valid-parentheses',
    title: '有效的括号',
    topicId: 'stack-queue',
    difficulty: 2,
    description:
      '给定一个只包括 (, ), {, }, [, ] 的字符串 s，判断字符串是否有效。有效字符串需满足：左括号必须用相同类型的右括号闭合，左括号必须以正确的顺序闭合。',
    examples: [
      { input: 's = "()"', output: 'True' },
      { input: 's = "()[]{}"', output: 'True' },
      { input: 's = "(]"', output: 'False' },
    ],
    starterCode: `def is_valid(s):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '"()"', expectedOutput: 'True' },
      { input: '"()[]{}"', expectedOutput: 'True' },
      { input: '"(]"', expectedOutput: 'False' },
      { input: '"([)]"', expectedOutput: 'False', isHidden: true },
      { input: '"{[]}"', expectedOutput: 'True', isHidden: true },
      { input: '""', expectedOutput: 'True', isHidden: true },
    ],
    hints: [
      '用栈来匹配括号',
      '遇到左括号入栈，遇到右括号检查栈顶是否匹配',
      '最后检查栈是否为空',
    ],
    solution: `def is_valid(s):
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in mapping:
            if not stack or stack[-1] != mapping[char]:
                return False
            stack.pop()
        else:
            stack.append(char)
    return len(stack) == 0`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    tags: ['栈', '字符串'],
  },
  {
    id: 'climbing-stairs',
    title: '爬楼梯',
    topicId: 'dp',
    difficulty: 2,
    description:
      '假设你正在爬楼梯。需要 n 阶你才能到达楼顶。每次你可以爬 1 或 2 个台阶。你有多少种不同的方法可以爬到楼顶呢？',
    examples: [
      { input: 'n = 2', output: '2', explanation: '1+1 或 2' },
      { input: 'n = 3', output: '3', explanation: '1+1+1, 1+2, 2+1' },
    ],
    constraints: ['1 <= n <= 45'],
    starterCode: `def climb_stairs(n):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '2', expectedOutput: '2' },
      { input: '3', expectedOutput: '3' },
      { input: '1', expectedOutput: '1', isHidden: true },
      { input: '4', expectedOutput: '5', isHidden: true },
      { input: '5', expectedOutput: '8', isHidden: true },
    ],
    hints: [
      '这其实是斐波那契数列的变形',
      'f(n) = f(n-1) + f(n-2)，到达第n阶可以从n-1阶爬1步或从n-2阶爬2步',
      '用两个变量滚动即可，不需要数组',
    ],
    solution: `def climb_stairs(n):
    if n <= 2:
        return n
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['动态规划', '斐波那契'],
  },
  {
    id: 'remove-duplicates',
    title: '删除有序数组中的重复项',
    topicId: 'two-pointers',
    difficulty: 2,
    description:
      '给你一个升序排列的数组 nums，请你原地删除重复出现的元素，使每个元素只出现一次，返回删除后数组的新长度。元素的相对顺序应该保持一致。',
    examples: [
      { input: 'nums = [1,1,2]', output: '2, nums = [1,2,_]', explanation: '函数返回新长度2' },
      { input: 'nums = [0,0,1,1,1,2,2,3,3,4]', output: '5, nums = [0,1,2,3,4]' },
    ],
    constraints: ['1 <= nums.length <= 3*10^4', '-100 <= nums[i] <= 100', 'nums 已按升序排列'],
    starterCode: `def remove_duplicates(nums):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[1,1,2]', expectedOutput: '2' },
      { input: '[0,0,1,1,1,2,2,3,3,4]', expectedOutput: '5' },
      { input: '[1]', expectedOutput: '1' },
      { input: '[1,2,3,4,5]', expectedOutput: '5', isHidden: true },
    ],
    hints: [
      '用快慢指针：慢指针指向已去重部分的末尾，快指针遍历',
      '当快指针遇到新元素时，慢指针前进一步并赋值',
      '慢指针最终位置+1就是新长度',
    ],
    solution: `def remove_duplicates(nums):
    if not nums:
        return 0
    slow = 0
    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow]:
            slow += 1
            nums[slow] = nums[fast]
    return slow + 1`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['双指针', '数组', '原地修改'],
  },
  {
    id: 'valid-palindrome',
    title: '验证回文串',
    topicId: 'two-pointers',
    difficulty: 1,
    description:
      '给定一个字符串，验证它是否是回文串，只考虑字母和数字字符，可以忽略字母的大小写。空字符串定义为有效回文串。',
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: 'True', explanation: '忽略非字母数字后是"amanaplanacanalpanama"' },
      { input: 's = "race a car"', output: 'False' },
      { input: 's = " "', output: 'True' },
    ],
    constraints: ['1 <= s.length <= 2*10^5'],
    starterCode: `def is_palindrome(s):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '"A man, a plan, a canal: Panama"', expectedOutput: 'True' },
      { input: '"race a car"', expectedOutput: 'False' },
      { input: '" "', expectedOutput: 'True' },
      { input: '"0P"', expectedOutput: 'False', isHidden: true },
      { input: '"a."', expectedOutput: 'True', isHidden: true },
    ],
    hints: [
      '用双指针从两端向中间移动',
      '跳过非字母数字字符（用 isalnum()）',
      '比较时统一转成小写',
    ],
    solution: `def is_palindrome(s):
    left, right = 0, len(s) - 1
    while left < right:
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1
        if s[left].lower() != s[right].lower():
            return False
        left += 1
        right -= 1
    return True`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['双指针', '字符串'],
  },
  {
    id: 'invert-binary-tree',
    title: '翻转二叉树',
    topicId: 'tree',
    difficulty: 2,
    description:
      '给你一棵二叉树的根节点 root，翻转这棵二叉树（交换每个节点的左右子节点），并返回其根节点。',
    examples: [
      { input: 'root = [4,2,7,1,3,6,9]', output: '[4,7,2,9,6,3,1]' },
      { input: 'root = [2,1,3]', output: '[2,3,1]' },
      { input: 'root = []', output: '[]' },
    ],
    constraints: ['树中节点数目在 [0, 100] 范围内'],
    starterCode: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def invert_tree(root):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[4,2,7,1,3,6,9]', expectedOutput: '[4,7,2,9,6,3,1]' },
      { input: '[2,1,3]', expectedOutput: '[2,3,1]' },
      { input: '[]', expectedOutput: '[]' },
    ],
    hints: [
      '递归思路：交换当前节点的左右子树，然后递归翻转左右子树',
      '基线条件：节点为 None 时返回',
      '也可以用迭代（BFS/DFS）实现',
    ],
    solution: `def invert_tree(root):
    if not root:
        return None
    root.left, root.right = root.right, root.left
    invert_tree(root.left)
    invert_tree(root.right)
    return root`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(h) — h为树高，递归栈',
    tags: ['二叉树', '递归', 'DFS'],
  },
  {
    id: 'max-depth-binary-tree',
    title: '二叉树的最大深度',
    topicId: 'tree',
    difficulty: 2,
    description:
      '给定一个二叉树 root，返回其最大深度。二叉树的最大深度是指从根节点到最远叶子节点的最长路径上的节点数。',
    examples: [
      { input: 'root = [3,9,20,null,null,15,7]', output: '3' },
      { input: 'root = [1,null,2]', output: '2' },
    ],
    constraints: ['树中节点数目在 [0, 10^4] 范围内'],
    starterCode: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def max_depth(root):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[3,9,20,null,null,15,7]', expectedOutput: '3' },
      { input: '[1,null,2]', expectedOutput: '2' },
      { input: '[]', expectedOutput: '0' },
      { input: '[1]', expectedOutput: '1', isHidden: true },
    ],
    hints: [
      '递归：max(左子树深度, 右子树深度) + 1',
      '基线条件：空节点深度为0',
      '也可以用BFS层序遍历',
    ],
    solution: `def max_depth(root):
    if not root:
        return 0
    return max(max_depth(root.left), max_depth(root.right)) + 1`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(h)',
    tags: ['二叉树', '递归', 'DFS'],
  },
  {
    id: 'merge-two-sorted-lists',
    title: '合并两个有序链表',
    topicId: 'linked-list',
    difficulty: 2,
    description:
      '将两个升序链表合并为一个新的升序链表并返回。新链表通过拼接给定的两个链表的节点组成。',
    examples: [
      { input: 'l1 = [1,2,4], l2 = [1,3,4]', output: '[1,1,2,3,4,4]' },
      { input: 'l1 = [], l2 = []', output: '[]' },
      { input: 'l1 = [], l2 = [0]', output: '[0]' },
    ],
    constraints: ['两个链表的节点数目范围是 [0, 50]'],
    starterCode: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def merge_two_lists(l1, l2):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[1,2,4], [1,3,4]', expectedOutput: '[1,1,2,3,4,4]' },
      { input: '[], []', expectedOutput: '[]' },
      { input: '[], [0]', expectedOutput: '[0]' },
      { input: '[5], [1,2,4]', expectedOutput: '[1,2,4,5]', isHidden: true },
    ],
    hints: [
      '用虚拟头节点（dummy）简化边界处理',
      '比较两个链表当前节点的值，较小的接到结果上',
      '一个链表走完后，直接接上另一个链表剩余部分',
    ],
    solution: `def merge_two_lists(l1, l2):
    dummy = ListNode()
    curr = dummy
    while l1 and l2:
        if l1.val <= l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next
    curr.next = l1 if l1 else l2
    return dummy.next`,
    timeComplexity: 'O(n+m)',
    spaceComplexity: 'O(1)',
    tags: ['链表', '双指针', '归并'],
  },
  {
    id: 'best-time-buy-sell',
    title: '买卖股票的最佳时机',
    topicId: 'greedy',
    difficulty: 2,
    description:
      '给定一个数组 prices，它的第 i 个元素 prices[i] 表示一支给定股票第 i 天的价格。你只能选择某一天买入这只股票，并选择在未来的某一个不同的日子卖出该股票。返回你可以从这笔交易中获取的最大利润。如果你不能获取任何利润，返回 0。',
    examples: [
      { input: 'prices = [7,1,5,3,6,4]', output: '5', explanation: '在第2天买入（价格=1），第5天卖出（价格=6），利润=5' },
      { input: 'prices = [7,6,4,3,1]', output: '0', explanation: '没有交易完成，最大利润为0' },
    ],
    constraints: ['1 <= prices.length <= 10^5', '0 <= prices[i] <= 10^4'],
    starterCode: `def max_profit(prices):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[7,1,5,3,6,4]', expectedOutput: '5' },
      { input: '[7,6,4,3,1]', expectedOutput: '0' },
      { input: '[2,4,1]', expectedOutput: '2' },
      { input: '[1]', expectedOutput: '0', isHidden: true },
      { input: '[3,2,6,5,0,3]', expectedOutput: '4', isHidden: true },
    ],
    hints: [
      '遍历一遍，维护到目前为止的最低价格',
      '对每一天计算：当天价格 - 历史最低价，更新最大利润',
      '不需要记录买入卖出的具体日期，只需跟踪最小值和最大差值',
    ],
    solution: `def max_profit(prices):
    min_price = float('inf')
    max_profit = 0
    for price in prices:
        if price < min_price:
            min_price = price
        elif price - min_price > max_profit:
            max_profit = price - min_price
    return max_profit`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['贪心', '数组', '动态规划'],
  },
  {
    id: 'flood-fill',
    title: '图像渲染（Flood Fill）',
    topicId: 'bfs-dfs',
    difficulty: 2,
    description:
      '给你一个二维整数数组 image 表示图像，从坐标 (sr, sc) 开始对图像进行洪水填充（将所有与起始像素同色且相连的像素替换为 newColor），返回填充后的图像。',
    examples: [
      { input: 'image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, newColor = 2', output: '[[2,2,2],[2,2,0],[2,0,1]]' },
      { input: 'image = [[0,0,0],[0,0,0]], sr = 0, sc = 0, newColor = 2', output: '[[2,2,2],[2,2,2]]' },
    ],
    constraints: ['m == image.length, n == image[i].length', '1 <= m,n <= 50'],
    starterCode: `def flood_fill(image, sr, sc, newColor):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[[1,1,1],[1,1,0],[1,0,1]], 1, 1, 2', expectedOutput: '[[2,2,2],[2,2,0],[2,0,1]]' },
      { input: '[[0,0,0],[0,0,0]], 0, 0, 2', expectedOutput: '[[2,2,2],[2,2,2]]' },
    ],
    hints: [
      'BFS或DFS：从起始点出发，向四个方向扩展',
      '记录原始颜色，只填充与原始颜色相同的像素',
      '注意：如果 newColor == 原始颜色，直接返回原图',
    ],
    solution: `def flood_fill(image, sr, sc, newColor):
    old = image[sr][sc]
    if old == newColor:
        return image
    rows, cols = len(image), len(image[0])
    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or image[r][c] != old:
            return
        image[r][c] = newColor
        dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1)
    dfs(sr, sc)
    return image`,
    timeComplexity: 'O(m*n)',
    spaceComplexity: 'O(m*n)',
    tags: ['DFS', 'BFS', '图', '矩阵'],
  },
  {
    id: 'permutations',
    title: '全排列',
    topicId: 'backtracking',
    difficulty: 3,
    description:
      '给定一个不含重复数字的数组 nums，返回其所有可能的全排列。你可以按任意顺序返回答案。',
    examples: [
      { input: 'nums = [1,2,3]', output: '[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]' },
      { input: 'nums = [0,1]', output: '[[0,1],[1,0]]' },
      { input: 'nums = [1]', output: '[[1]]' },
    ],
    constraints: ['1 <= nums.length <= 6', 'nums 中的所有整数互不相同'],
    starterCode: `def permute(nums):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '[1,2,3]', expectedOutput: '[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]' },
      { input: '[0,1]', expectedOutput: '[[0,1],[1,0]]' },
      { input: '[1]', expectedOutput: '[[1]]' },
    ],
    hints: [
      '回溯模板：选择-递归-撤销选择',
      '用used数组或path集合记录已使用的元素',
      '终止条件：path长度等于nums长度',
    ],
    solution: `def permute(nums):
    result = []
    def backtrack(path, used):
        if len(path) == len(nums):
            result.append(path[:])
            return
        for i in range(len(nums)):
            if used[i]: continue
            used[i] = True
            path.append(nums[i])
            backtrack(path, used)
            path.pop()
            used[i] = False
    backtrack([], [False]*len(nums))
    return result`,
    timeComplexity: 'O(n*n!)',
    spaceComplexity: 'O(n)',
    tags: ['回溯', 'DFS', '排列'],
  },
  {
    id: 'longest-substring-without-repeat',
    title: '无重复字符的最长子串',
    topicId: 'sliding-window',
    difficulty: 3,
    description:
      '给定一个字符串 s，找出其中不含有重复字符的最长子串的长度。',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: '无重复字符的最长子串是"abc"，长度为3' },
      { input: 's = "bbbbb"', output: '1' },
      { input: 's = "pwwkew"', output: '3', explanation: '最长子串是"wke"，长度为3' },
    ],
    constraints: ['0 <= s.length <= 5*10^4'],
    starterCode: `def length_of_longest_substring(s):
    # 在这里写你的代码
    pass`,
    testCases: [
      { input: '"abcabcbb"', expectedOutput: '3' },
      { input: '"bbbbb"', expectedOutput: '1' },
      { input: '"pwwkew"', expectedOutput: '3' },
      { input: '""', expectedOutput: '0', isHidden: true },
      { input: '"au"', expectedOutput: '2', isHidden: true },
    ],
    hints: [
      '滑动窗口：用左右指针维护窗口',
      '用集合或字典记录窗口内的字符',
      '遇到重复字符时移动左指针到重复位置+1',
    ],
    solution: `def length_of_longest_substring(s):
    char_map = {}
    left = 0
    max_len = 0
    for right, ch in enumerate(s):
        if ch in char_map and char_map[ch] >= left:
            left = char_map[ch] + 1
        char_map[ch] = right
        max_len = max(max_len, right - left + 1)
    return max_len`,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(min(m,n)) — m为字符集大小',
    tags: ['滑动窗口', '双指针', '哈希表', '字符串'],
  },
];

export function getProblemById(id: string): AlgorithmProblem | undefined {
  return PROBLEM_BANK.find((p) => p.id === id);
}

export function getProblemsByTopic(topicId: string): AlgorithmProblem[] {
  return PROBLEM_BANK.filter((p) => p.topicId === topicId);
}

export function getProblemsByDifficulty(difficulty: number): AlgorithmProblem[] {
  return PROBLEM_BANK.filter((p) => p.difficulty === difficulty);
}

export function getRandomProblem(topicId?: string): AlgorithmProblem {
  const pool = topicId ? getProblemsByTopic(topicId) : PROBLEM_BANK;
  return pool[Math.floor(Math.random() * pool.length)] || PROBLEM_BANK[0];
}
