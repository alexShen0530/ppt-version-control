"""
通用并发工具函数
提供带超时和重试机制的并发执行功能
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FutureTimeoutError
from typing import Callable, Any, List, Tuple

logger = logging.getLogger(__name__)


def execute_with_retry_and_timeout(
        func: Callable,
        args: tuple = (),
        kwargs: dict = None,
        timeout_seconds: int = 120,
        max_retries: int = 3,
        task_name: str = "task"
) -> Any:
    """
    执行函数，支持超时和重试机制

    Args:
        func: 要执行的函数
        args: 函数的位置参数
        kwargs: 函数的关键字参数
        timeout_seconds: 超时时间（秒）
        max_retries: 最大重试次数
        task_name: 任务名称，用于日志记录

    Returns:
        函数执行结果

    Raises:
        Exception: 如果所有重试都失败，抛出最后一次的异常
    """
    if kwargs is None:
        kwargs = {}

    last_exception = None

    for attempt in range(max_retries + 1):
        executor = ThreadPoolExecutor(max_workers=1)
        future = None
        try:
            if attempt > 0:
                logger.info(f"Retrying {task_name} (attempt {attempt + 1}/{max_retries + 1})")
            else:
                logger.info(f"Executing {task_name}")

            future = executor.submit(func, *args, **kwargs)
            try:
                result = future.result(timeout=timeout_seconds)
                logger.info(f"Completed {task_name}")
                return result
            except FutureTimeoutError:
                last_exception = TimeoutError(
                    f"{task_name} timed out after {timeout_seconds}s (attempt {attempt + 1}/{max_retries + 1})"
                )
                logger.warning(str(last_exception))

                # 尝试取消任务（注意：cancel()只能取消尚未开始的任务）
                cancelled = future.cancel()
                if not cancelled:
                    logger.warning(f"{task_name} could not be cancelled, it may still be running")

                # 等待一小段时间让线程有机会清理资源（若底层调用支持超时，会更快释放）
                time.sleep(0.5)

                if attempt < max_retries:
                    logger.info(f"Will retry {task_name} in next attempt")
                    continue
                raise last_exception
        except Exception as e:
            last_exception = e
            logger.error(f"Error executing {task_name} (attempt {attempt + 1}): {e}")
            if attempt < max_retries:
                logger.info(f"Will retry {task_name} in next attempt")
                continue
            break
        finally:
            # 关键：不要在超时场景等待线程结束，否则会“假超时”并卡住并发池
            try:
                executor.shutdown(wait=False, cancel_futures=True)
            except TypeError:
                # Python < 3.9 doesn't support cancel_futures
                executor.shutdown(wait=False)

    # 如果所有重试都失败了，抛出最后一次的异常
    if last_exception:
        raise last_exception
    else:
        raise Exception(f"{task_name} failed after {max_retries + 1} attempts")


def execute_parallel_with_retry_and_timeout(
        tasks: List[Tuple[Callable, tuple, dict, str]],
        max_workers: int = 5,
        timeout_seconds: int = 120,
        max_retries: int = 3
) -> List[Any]:
    """
    并行执行多个任务，每个任务都支持超时和重试机制

    Args:
        tasks: 任务列表，每个任务是一个元组 (func, args, kwargs, task_name)
        max_workers: 最大工作线程数
        timeout_seconds: 每个任务的超时时间（秒）
        max_retries: 每个任务的最大重试次数

    Returns:
        任务执行结果列表，按输入顺序排列
    """
    if not tasks:
        return []

    results = [None] * len(tasks)
    completed_count = 0
    total_tasks = len(tasks)

    logger.info(f"Starting parallel execution of {total_tasks} tasks with {max_workers} workers")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任务
        future_to_task = {}
        for i, (func, args, kwargs, task_name) in enumerate(tasks):
            future = executor.submit(
                execute_with_retry_and_timeout,
                func, args, kwargs, timeout_seconds, max_retries, task_name
            )
            future_to_task[future] = (i, task_name)

        # 收集结果
        for future in as_completed(future_to_task):
            task_index, task_name = future_to_task[future]
            try:
                result = future.result()
                results[task_index] = result
                completed_count += 1
                logger.info(f"Completed {completed_count}/{total_tasks} tasks")
            except Exception as e:
                logger.error(f"Task {task_name} failed: {e}")
                # 保持结果为None，调用者可以检查并处理
                completed_count += 1

    logger.info(f"Parallel execution completed: {completed_count}/{total_tasks} tasks finished")
    return results


def execute_parallel_with_fallback(
        tasks: List[Tuple[Callable, tuple, dict, str, Any]],
        max_workers: int = 5,
        timeout_seconds: int = 120,
        max_retries: int = 3
) -> List[Any]:
    """
    并行执行多个任务，支持回退值

    Args:
        tasks: 任务列表，每个任务是一个元组 (func, args, kwargs, task_name, fallback_value)
        max_workers: 最大工作线程数
        timeout_seconds: 每个任务的超时时间（秒）
        max_retries: 每个任务的最大重试次数

    Returns:
        任务执行结果列表，失败的任务使用回退值
    """
    if not tasks:
        return []

    results = [None] * len(tasks)
    completed_count = 0
    total_tasks = len(tasks)

    logger.info(f"Starting parallel execution of {total_tasks} tasks with {max_workers} workers")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任务
        future_to_task = {}
        for i, (func, args, kwargs, task_name, fallback_value) in enumerate(tasks):
            future = executor.submit(
                execute_with_retry_and_timeout,
                func, args, kwargs, timeout_seconds, max_retries, task_name
            )
            future_to_task[future] = (i, task_name, fallback_value)

        # 收集结果
        for future in as_completed(future_to_task):
            task_index, task_name, fallback_value = future_to_task[future]
            try:
                result = future.result()
                results[task_index] = result
                completed_count += 1
                logger.info(f"Completed {completed_count}/{total_tasks} tasks")
            except Exception as e:
                logger.error(f"Task {task_name} failed, using fallback value: {e}")
                results[task_index] = fallback_value
                completed_count += 1

    logger.info(f"Parallel execution completed: {completed_count}/{total_tasks} tasks finished")
    return results